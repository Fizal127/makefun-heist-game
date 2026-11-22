// The heist itself: pure rules, no drawing and no browser in it. The thief, the
// patrolling guards, the sweeping cameras, the alarm meter, the tools and the loot.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns.
import { CAMERA, GUARD, SCORE, STEP, THIEF, TOOLS, VISION } from './config.js';
import { createLevel, EXIT_RADIUS } from './level.js';
import { angleDifference, cameraWatcher, canSee, guardWatcher } from './vision.js';

export const MODE_PATROL = 'patrol';
export const MODE_INVESTIGATE = 'investigate';
export const MODE_CHASE = 'chase';

export const EVENT_LOOT = 1;
export const EVENT_STAR = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_ESCAPED = 8;
export const EVENT_ALARM = 16;
export const EVENT_HACK = 32;
export const EVENT_SMOKE = 64;
export const EVENT_COIN = 128;

const TURN_RATE = 5;
const GRACE_SECONDS = 2;

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function moveWithCollision(body, dx, dy, level) {
  const bounds = level.bounds;
  const nextX = Math.max(bounds.minX + body.radius, Math.min(bounds.maxX - body.radius, body.x + dx));
  let blocked = false;
  for (let i = 0; i < level.cases.length; i += 1) {
    if (circleHitsRect(nextX, body.y, body.radius, level.cases[i])) {
      blocked = true;
      break;
    }
  }
  if (!blocked) body.x = nextX;
  const nextY = Math.max(bounds.minY + body.radius, Math.min(bounds.maxY - body.radius, body.y + dy));
  blocked = false;
  for (let i = 0; i < level.cases.length; i += 1) {
    if (circleHitsRect(body.x, nextY, body.radius, level.cases[i])) {
      blocked = true;
      break;
    }
  }
  if (!blocked) body.y = nextY;
}

function turnToward(angle, target, maxTurn) {
  const diff = angleDifference(target, angle);
  if (diff > maxTurn) return angle + maxTurn;
  if (diff < -maxTurn) return angle - maxTurn;
  return target;
}

export function createWorld() {
  const level = createLevel();
  const state = {
    level,
    thief: { x: 0, y: 0, angle: -Math.PI / 2, radius: THIEF.radius, moving: false },
    guards: [],
    cameras: [],
    loot: [],
    smoke: [],
    coins: [],
    alarm: 0,
    alert: false,
    alarmTripped: false,
    score: 0,
    time: 0,
    phase: 'play',
    tools: { smoke: TOOLS.smokeCount, coins: TOOLS.coinCount },
    grace: GRACE_SECONDS,
    starTaken: false,
  };

  function reset() {
    const thief = state.thief;
    thief.x = level.thiefStart.x;
    thief.y = level.thiefStart.y;
    thief.angle = -Math.PI / 2;
    thief.moving = false;
    state.guards = level.guards.map((def) => ({
      name: def.name,
      waypoints: def.waypoints,
      wpIndex: 0,
      wpDir: 1,
      x: def.waypoints[0].x,
      y: def.waypoints[0].y,
      angle: 0,
      radius: GUARD.radius,
      mode: MODE_PATROL,
      targetX: def.waypoints[0].x,
      targetY: def.waypoints[0].y,
      memory: 0,
      wait: 0,
    }));
    state.cameras = level.cameras.map((def) => ({
      x: def.x,
      y: def.y,
      baseAngle: def.angle,
      angle: def.angle,
      disabled: false,
      disableTimer: 0,
      hackProgress: 0,
    }));
    state.loot = level.loot.map((item) => ({ ...item }));
    state.smoke = [];
    state.coins = [];
    state.alarm = 0;
    state.alert = false;
    state.alarmTripped = false;
    state.score = 0;
    state.time = 0;
    state.phase = 'play';
    state.tools.smoke = TOOLS.smokeCount;
    state.tools.coins = TOOLS.coinCount;
    state.grace = GRACE_SECONDS;
    state.starTaken = false;
  }

  function stepGuard(guard, dt) {
    let speed = GUARD.patrolSpeed;
    let destX = guard.targetX;
    let destY = guard.targetY;
    if (guard.mode === MODE_PATROL) {
      const wp = guard.waypoints[guard.wpIndex];
      destX = wp.x;
      destY = wp.y;
      const dx = destX - guard.x;
      const dy = destY - guard.y;
      if (dx * dx + dy * dy < 36) {
        guard.wpIndex += guard.wpDir;
        if (guard.wpIndex >= guard.waypoints.length) {
          guard.wpIndex = guard.waypoints.length - 2;
          guard.wpDir = -1;
        } else if (guard.wpIndex < 0) {
          guard.wpIndex = 1;
          guard.wpDir = 1;
        }
      }
    } else if (guard.mode === MODE_CHASE) {
      speed = GUARD.chaseSpeed;
      destX = guard.targetX;
      destY = guard.targetY;
      const dx = destX - guard.x;
      const dy = destY - guard.y;
      if (dx * dx + dy * dy < 100) {
        guard.memory -= dt;
        if (guard.memory <= 0) {
          guard.mode = MODE_PATROL;
          guard.targetX = guard.waypoints[guard.wpIndex].x;
          guard.targetY = guard.waypoints[guard.wpIndex].y;
        }
      }
    } else if (guard.mode === MODE_INVESTIGATE) {
      destX = guard.targetX;
      destY = guard.targetY;
      const dx = destX - guard.x;
      const dy = destY - guard.y;
      if (dx * dx + dy * dy < 100) {
        guard.wait -= dt;
        if (guard.wait <= 0) {
          guard.mode = MODE_PATROL;
          guard.targetX = guard.waypoints[guard.wpIndex].x;
          guard.targetY = guard.waypoints[guard.wpIndex].y;
        }
      }
    }
    const dx = destX - guard.x;
    const dy = destY - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      const stepLen = Math.min(dist, speed * dt);
      const nx = guard.x + (dx / dist) * stepLen;
      const ny = guard.y + (dy / dist) * stepLen;
      guard.x = nx;
      guard.y = ny;
      guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), TURN_RATE * dt);
    }
  }

  function stepCamera(camera, dt) {
    if (camera.disabled) {
      camera.disableTimer -= dt;
      if (camera.disableTimer <= 0) {
        camera.disabled = false;
        camera.disableTimer = 0;
      }
      return;
    }
    camera.angle =
      camera.baseAngle + Math.sin(state.time * CAMERA.sweepSpeed) * CAMERA.sweepHalfAngle;
  }

  /**
   * One fixed step. `input` is { mx, my, smoke, toss, hack } — the move vector, a
   * one-shot smoke request, a {x,y} coin toss or null, and whether E is held.
   * With `harmless` set (the title screen's backdrop) the thief never scores, never
   * trips the alarm and cannot be caught.
   */
  function step(dt, input, harmless) {
    if (state.phase !== 'play') return 0;
    let events = 0;
    state.time += dt;
    if (state.grace > 0) state.grace -= dt;

    // The thief moves, axis by axis, sliding along cases.
    const thief = state.thief;
    const len = Math.hypot(input.mx, input.my);
    thief.moving = len > 0.01;
    if (thief.moving) {
      const nx = input.mx / len;
      const ny = input.my / len;
      thief.angle = Math.atan2(ny, nx);
      moveWithCollision(thief, nx * THIEF.speed * dt, ny * THIEF.speed * dt, level);
    }

    // Smoke bomb: a cloud that blinds every cone it touches.
    if (input.smoke && state.tools.smoke > 0) {
      state.tools.smoke -= 1;
      state.smoke.push({ x: thief.x, y: thief.y, r: TOOLS.smokeRadius, t: TOOLS.smokeSeconds });
      events |= EVENT_SMOKE;
    }
    // Coin toss: the nearest guards walk over to look at where it landed.
    if (input.toss && state.tools.coins > 0) {
      state.tools.coins -= 1;
      state.coins.push({ x: input.toss.x, y: input.toss.y, t: 6 });
      for (const guard of state.guards) {
        const dx = guard.x - input.toss.x;
        const dy = guard.y - input.toss.y;
        if (dx * dx + dy * dy < TOOLS.coinHearing * TOOLS.coinHearing) {
          guard.mode = MODE_INVESTIGATE;
          guard.targetX = input.toss.x;
          guard.targetY = input.toss.y;
          guard.wait = GUARD.investigateTime;
        }
      }
      events |= EVENT_COIN;
    }
    // Hacking: stand beside a camera and hold E until it goes dark.
    for (const camera of state.cameras) {
      if (camera.disabled) continue;
      const dx = thief.x - camera.x;
      const dy = thief.y - camera.y;
      const near = dx * dx + dy * dy < CAMERA.hackRadius * CAMERA.hackRadius;
      if (near && input.hack) {
        camera.hackProgress += dt;
        if (camera.hackProgress >= CAMERA.hackSeconds) {
          camera.disabled = true;
          camera.disableTimer = CAMERA.disabledSeconds;
          camera.hackProgress = 0;
          events |= EVENT_HACK;
        }
      } else {
        camera.hackProgress = Math.max(0, camera.hackProgress - dt * 2);
      }
    }

    for (let i = state.smoke.length - 1; i >= 0; i -= 1) {
      state.smoke[i].t -= dt;
      if (state.smoke[i].t <= 0) state.smoke.splice(i, 1);
    }
    for (let i = state.coins.length - 1; i >= 0; i -= 1) {
      state.coins[i].t -= dt;
      if (state.coins[i].t <= 0) state.coins.splice(i, 1);
    }

    // Cameras sweep, guards walk their routes.
    for (const camera of state.cameras) stepCamera(camera, dt);
    for (const guard of state.guards) stepGuard(guard, dt);

    // Who can see the thief right now?
    let seenByGuard = false;
    let seenByCamera = false;
    if (!harmless && state.grace <= 0) {
      for (const guard of state.guards) {
        if (canSee(guardWatcher(guard), thief, level.cases, state.smoke)) {
          seenByGuard = true;
          guard.mode = MODE_CHASE;
          guard.targetX = thief.x;
          guard.targetY = thief.y;
          guard.memory = GUARD.chaseMemory;
        }
      }
      for (const camera of state.cameras) {
        if (!camera.disabled && canSee(cameraWatcher(camera), thief, level.cases, state.smoke)) {
          seenByCamera = true;
        }
      }
    }

    // The alarm meter: seen and it climbs, hidden and it falls.
    if (seenByGuard || seenByCamera) {
      let rate = 0;
      if (seenByGuard) rate += VISION.guardAlarmRate;
      if (seenByCamera) rate += VISION.cameraAlarmRate;
      state.alarm = Math.min(100, state.alarm + rate * dt);
    } else {
      state.alarm = Math.max(0, state.alarm - VISION.decayRate * dt);
    }
    if (state.alarm >= 100 && !state.alert) {
      state.alert = true;
      state.alarmTripped = true;
      events |= EVENT_ALARM;
      for (const guard of state.guards) {
        guard.mode = MODE_CHASE;
        guard.targetX = thief.x;
        guard.targetY = thief.y;
        guard.memory = GUARD.chaseMemory;
      }
    } else if (state.alert && state.alarm < 50) {
      state.alert = false;
    }

    // Caught: a guard close enough to grab the thief.
    if (!harmless) {
      for (const guard of state.guards) {
        const dx = guard.x - thief.x;
        const dy = guard.y - thief.y;
        if (dx * dx + dy * dy < GUARD.catchRadius * GUARD.catchRadius) {
          state.phase = 'busted';
          return events | EVENT_CAUGHT;
        }
      }
    }

    // Loot: close enough and it is yours.
    if (!harmless) {
      for (const item of state.loot) {
        if (item.taken) continue;
        const dx = item.x - thief.x;
        const dy = item.y - thief.y;
        if (dx * dx + dy * dy < THIEF.grabRadius * THIEF.grabRadius) {
          item.taken = true;
          if (item.kind === 'star') {
            state.starTaken = true;
            state.score += SCORE.star;
            state.alarm = Math.min(100, state.alarm + VISION.starAlarmJump);
            for (const guard of state.guards) {
              guard.mode = MODE_INVESTIGATE;
              guard.targetX = item.x;
              guard.targetY = item.y;
              guard.wait = 6;
            }
            events |= EVENT_STAR;
          } else {
            state.score += SCORE.sideLoot;
            events |= EVENT_LOOT;
          }
        }
      }
    }

    // The getaway: Star in hand, back at the skylight vent.
    if (!harmless && state.starTaken) {
      const dx = level.exit.x - thief.x;
      const dy = level.exit.y - thief.y;
      if (dx * dx + dy * dy < EXIT_RADIUS * EXIT_RADIUS) {
        state.phase = 'escaped';
        if (!state.alarmTripped) state.score += SCORE.cleanBonus;
        return events | EVENT_ESCAPED;
      }
    }
    return events;
  }

  /**
   * Would the thief be seen standing at (x, y) right now? The autopilot in shots.js
   * asks this before every step it takes.
   */
  function seenAt(x, y) {
    const probe = { x, y };
    for (const guard of state.guards) {
      if (canSee(guardWatcher(guard), probe, level.cases, state.smoke)) return true;
    }
    for (const camera of state.cameras) {
      if (!camera.disabled && canSee(cameraWatcher(camera), probe, level.cases, state.smoke)) {
        return true;
      }
    }
    return false;
  }

  reset();
  return { state, reset, step, seenAt };
}

export { STEP };

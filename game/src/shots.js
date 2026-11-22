// The screenshot scenes behind ?shot=start|room|alarm|escape. Each one plays the real
// rules forward from a fresh world, steered by a navigator that walks the gallery's
// waypoint graph — a thief plans a route around the cases and waits out the cones,
// it does not blunder into them. So the frame is what a short game really looks
// like, and the same seed always gives the same frame.
import { FIELD, STEP, THIEF } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED } from './world.js';
import { hasLineOfSight, segmentHitsRect } from './vision.js';
import { SCREEN_BUSTED, SCREEN_ESCAPED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const ROOM_SECONDS = 14;
const ESCAPE_LIMIT_SECONDS = 300;

// The gallery's walkable route, node by node. Every edge is a straight line the
// thief can walk without crossing a case; the pilot only ever walks edges, so it
// can never get stuck behind furniture the way a greedy step can.
const NODES = {
  S: [640, 625],
  A: [640, 520],
  H: [640, 430],
  W1: [500, 430],
  W2: [500, 280],
  I: [640, 250],
  J: [640, 110],
  K: [640, 668],
  C: [200, 420],
  D: [200, 220],
  E: [1080, 420],
  F: [1080, 220],
  E2: [780, 430],
  E3: [780, 280],
};

const EDGES = {
  S: ['A'],
  A: ['S', 'H', 'C', 'E', 'K'],
  H: ['A', 'W1', 'E2', 'K'],
  W1: ['H', 'W2'],
  W2: ['W1', 'I'],
  I: ['W2', 'E3', 'J'],
  J: ['I'],
  K: ['A', 'H'],
  C: ['A', 'D'],
  D: ['C'],
  E: ['A', 'F'],
  F: ['E'],
  E2: ['H', 'E3'],
  E3: ['E2', 'I'],
};

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function pointBlocked(x, y, cases) {
  for (const c of cases) {
    if (x > c.x - THIEF.radius && x < c.x + c.w + THIEF.radius
      && y > c.y - THIEF.radius && y < c.y + c.h + THIEF.radius) return true;
  }
  return false;
}

function nearestNode(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const name of Object.keys(NODES)) {
    const d = dist(x, y, NODES[name][0], NODES[name][1]);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

/** The shortest route through the graph, as a list of node names. */
function findRoute(from, to) {
  if (from === to) return [from];
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const next of EDGES[node] || []) {
      if (!(next in prev)) {
        prev[next] = node;
        if (next === to) {
          const path = [to];
          let at = to;
          while (prev[at] !== null) {
            at = prev[at];
            path.unshift(at);
          }
          return path;
        }
        queue.push(next);
      }
    }
  }
  return [from];
}

function nearestGuardDist(state, x, y) {
  let best = Infinity;
  for (const guard of state.guards) {
    best = Math.min(best, dist(x, y, guard.x, guard.y));
  }
  return best;
}

/**
 * Flee: the thief has been seen. Roll each of the eight directions forward for
 * 1.5 s and take the one that ends safest. A guard on patrol does not know the
 * thief is there, so breaking its line of sight behind a case counts; a guard
 * already chasing knows where the thief was and walks around the case, so
 * against a chaser only distance counts — the thief must get far away, not just
 * duck behind the nearest furniture. An endpoint hemmed in by cases scores badly
 * (a corner with no way out is a trap). A one-step look cannot see any of this;
 * the rollout can.
 */
function fleeStep(world, tx, ty) {
  const state = world.state;
  const thief = state.thief;
  const ROLL_STEPS = 30;
  let best = { mx: 0, my: 0, score: -Infinity };
  for (let d = 0; d < 8; d += 1) {
    const [dx, dy] = DIRS[d];
    const len = Math.hypot(dx, dy) || 1;
    let x = thief.x;
    let y = thief.y;
    for (let i = 0; i < ROLL_STEPS; i += 1) {
      const nx = x + (dx / len) * THIEF.speed * STEP;
      const ny = y + (dy / len) * THIEF.speed * STEP;
      if (pointBlocked(nx, ny, state.level.cases)) break;
      if (nx < 30 || ny < 30 || nx > FIELD.width - 30 || ny > FIELD.height - 30) break;
      x = nx;
      y = ny;
    }
    const seen = world.seenAt(x, y);
    let score = 0;
    for (const guard of state.guards) {
      const dGuard = dist(x, y, guard.x, guard.y);
      if (guard.mode === 'chase') {
        // A chaser walks around cover, so only distance helps.
        score += dGuard * 10;
      } else {
        score += dGuard * 2;
        if (!hasLineOfSight(guard.x, guard.y, x, y, state.level.cases)) score += 1000;
      }
    }
    if (seen) score -= 10000;
    // Open space around the endpoint: how many ways out does the thief have?
    let mobility = 0;
    for (const [mdx, mdy] of DIRS) {
      const mLen = Math.hypot(mdx, mdy) || 1;
      const mx = x + (mdx / mLen) * THIEF.speed * STEP;
      const my = y + (mdy / mLen) * THIEF.speed * STEP;
      if (!pointBlocked(mx, my, state.level.cases)
        && mx >= 30 && my >= 30 && mx <= FIELD.width - 30 && my <= FIELD.height - 30) mobility += 1;
    }
    score += mobility * 400 - dist(x, y, tx, ty) * 1.0;
    if (score > best.score) best = { mx: dx / len, my: dy / len, score };
  }
  return best;
}

const DIRS = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
  [0, 0],
];

/**
 * One careful step toward (tx, ty). Seen and the pilot flees. Unseen and it takes
 * the move that gets closest to the target without stepping into a cone — and if
 * every move would step into one, it waits for the cone to pass rather than walk
 * into it. `seenTime` is how long the thief has been seen without a break; past a
 * second of it the pilot burns a smoke bomb to break the chase.
 *
 * A cone check alone is not enough: a guard walking its route can step onto the
 * thief even when the thief is outside every cone, so no move may put the thief
 * inside a 40 px bubble around a guard's body (the catch radius is 24 px, the
 * bubble leaves room for a step either way). If the thief is already inside a
 * bubble it flees instead of waiting.
 * Returns { mx, my, smoke }.
 */
const GUARD_BUBBLE = 40;

function tooCloseToGuard(state, x, y) {
  for (const guard of state.guards) {
    if (dist(x, y, guard.x, guard.y) < GUARD_BUBBLE) return true;
  }
  return false;
}

/**
 * The safe step that puts the most room between the thief and the nearest guard,
 * or null when every step is seen, too close or blocked. Used when the thief
 * cannot advance: it backs away instead of standing still and letting a guard
 * walk into it.
 */
function retreatStep(world) {
  const state = world.state;
  const thief = state.thief;
  let retreat = null;
  let retreatScore = -Infinity;
  for (const [dx, dy] of DIRS) {
    if (dx === 0 && dy === 0) continue;
    const len = Math.hypot(dx, dy) || 1;
    const nx = thief.x + (dx / len) * THIEF.speed * STEP;
    const ny = thief.y + (dy / len) * THIEF.speed * STEP;
    if (pointBlocked(nx, ny, state.level.cases)) continue;
    if (nx < 30 || ny < 30 || nx > FIELD.width - 30 || ny > FIELD.height - 30) continue;
    if (world.seenAt(nx, ny)) continue;
    if (tooCloseToGuard(state, nx, ny)) continue;
    const score = nearestGuardDist(state, nx, ny);
    if (score > retreatScore) {
      retreatScore = score;
      retreat = { mx: dx / len, my: dy / len };
    }
  }
  return retreat;
}

function carefulStep(world, tx, ty, seenTime) {
  const state = world.state;
  const thief = state.thief;
  if (world.seenAt(thief.x, thief.y) || tooCloseToGuard(state, thief.x, thief.y)) {
    const flee = fleeStep(world, tx, ty);
    const smoke = seenTime > 1 && state.tools.smoke > 0;
    return { mx: flee.mx, my: flee.my, smoke };
  }
  // A guard is hunting the thief: do not advance toward the target — that walks
  // back into the cone it just fled from. Retreat away from the hunter instead;
  // holding still only lets it walk up to the thief. (If the guard does spot
  // the thief while it retreats, the seen branch above takes over and it flees.)
  for (const guard of state.guards) {
    if (guard.mode === 'chase' && dist(thief.x, thief.y, guard.x, guard.y) < 300) {
      const retreat = retreatStep(world);
      if (retreat !== null) return { mx: retreat.mx, my: retreat.my, smoke: false };
      return { mx: 0, my: 0, smoke: false };
    }
  }
  let best = null;
  let bestScore = -Infinity;
  for (const [dx, dy] of DIRS) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = thief.x + (dx / len) * THIEF.speed * STEP;
    const ny = thief.y + (dy / len) * THIEF.speed * STEP;
    if (pointBlocked(nx, ny, state.level.cases)) continue;
    if (nx < 30 || ny < 30 || nx > FIELD.width - 30 || ny > FIELD.height - 30) continue;
    if (world.seenAt(nx, ny)) continue;
    if (tooCloseToGuard(state, nx, ny)) continue;
    let score = -dist(nx, ny, tx, ty);
    if (dx === 0 && dy === 0) score -= 2; // prefer moving when it is safe
    if (score > bestScore) {
      bestScore = score;
      best = { mx: dx / len, my: dy / len };
    }
  }
  if (best !== null) return { mx: best.mx, my: best.my, smoke: false };
  // No safe step toward the target: the cone (or a guard) is on the way. Do not
  // stand still and let the guard walk into the thief — retreat to the safe step
  // that puts the most room between the thief and the nearest guard.
  const retreat = retreatStep(world);
  if (retreat !== null) return { mx: retreat.mx, my: retreat.my, smoke: false };
  return { mx: 0, my: 0, smoke: false };
}

/**
 * The navigator: give it a destination and it walks the graph to it, one waypoint
 * at a time, waiting out any cone on the way. `step` returns the move for this
 * frame and whether the destination was reached.
 */
function createNavigator(world) {
  let waypoints = [];
  let index = 0;

  function setDestination(tx, ty) {
    const from = nearestNode(world.state.thief.x, world.state.thief.y);
    const to = nearestNode(tx, ty);
    const names = findRoute(from, to);
    waypoints = names.map((name) => NODES[name]);
    waypoints.push([tx, ty]);
    index = 0;
  }

  function step(seenTime) {
    while (index < waypoints.length) {
      const [wx, wy] = waypoints[index];
      if (dist(world.state.thief.x, world.state.thief.y, wx, wy) < 16) index += 1;
      else break;
    }
    if (index >= waypoints.length) return { mx: 0, my: 0, smoke: false, done: true };
    const [wx, wy] = waypoints[index];
    const move = carefulStep(world, wx, wy, seenTime);
    return { mx: move.mx, my: move.my, smoke: move.smoke, done: false };
  }

  return { setDestination, step };
}

function idleInput() {
  return { mx: 0, my: 0, smoke: false, toss: null, hack: false };
}

/** The screen the frame should draw when the run ended early. */
function endScreen(world, fallback) {
  if (world.state.phase === 'busted') return SCREEN_BUSTED;
  if (world.state.phase === 'escaped') return SCREEN_ESCAPED;
  return fallback;
}

/** True when the straight walk from (x1,y1) to (x2,y2) clears every case. */
export function legClear(x1, y1, x2, y2, cases) {
  for (const c of cases) {
    const grown = { x: c.x - THIEF.radius, y: c.y - THIEF.radius, w: c.w + THIEF.radius * 2, h: c.h + THIEF.radius * 2 };
    if (segmentHitsRect(x1, y1, x2, y2, grown)) return false;
  }
  return true;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'room') {
    // Cross the hall: the Emerald Brooch first, then the Star, then the vent.
    const nav = createNavigator(world);
    let seenTime = 0;
    let leg = 0;
    const targets = [
      world.state.loot.find((item) => item.name === 'Emerald Brooch'),
      world.state.loot.find((item) => item.kind === 'star'),
      world.state.level.exit,
    ];
    nav.setDestination(targets[0].x, targets[0].y);
    const steps = Math.floor(ROOM_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      seenTime = world.seenAt(world.state.thief.x, world.state.thief.y) ? seenTime + STEP : 0;
      const move = nav.step(seenTime);
      if (move.done && leg < targets.length - 1) {
        leg += 1;
        nav.setDestination(targets[leg].x, targets[leg].y);
      }
      const events = world.step(STEP, {
        mx: move.mx, my: move.my, smoke: move.smoke, toss: null, hack: false,
      }, false);
      if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
    }
    return { screen: endScreen(world, SCREEN_PLAY), best: world.state.score };
  }
  if (name === 'alarm') {
    // Stand under the north camera's sweeping cone until the meter runs hot, then
    // stop: the frame catches the thief in the cone with the alarm high. No guard
    // can see this spot (Dmitri's cone is level, Mara's is 200 px south), so the
    // thief is safe standing here — the camera alone drives the meter.
    const nav = createNavigator(world);
    let phase = 0;
    let seenTime = 0;
    const steps = Math.floor(30 / STEP);
    nav.setDestination(300, 240);
    for (let i = 0; i < steps; i += 1) {
      const state = world.state;
      seenTime = world.seenAt(state.thief.x, state.thief.y) ? seenTime + STEP : 0;
      let input = idleInput();
      if (phase === 0) {
        const move = nav.step(seenTime);
        if (move.done) phase = 1;
        else input = { mx: move.mx, my: move.my, smoke: move.smoke, toss: null, hack: false };
      } else if (state.alarm >= 70) {
        break;
      }
      const events = world.step(STEP, input, false);
      if (events & EVENT_CAUGHT) break;
    }
    return { screen: endScreen(world, SCREEN_PLAY), best: world.state.score };
  }
  if (name === 'escape') {
    // The full run: straight for the Star, then straight for the vent.
    const nav = createNavigator(world);
    let seenTime = 0;
    let won = false;
    const star = world.state.loot.find((item) => item.kind === 'star');
    nav.setDestination(star.x, star.y);
    const steps = Math.floor(ESCAPE_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const state = world.state;
      seenTime = world.seenAt(state.thief.x, state.thief.y) ? seenTime + STEP : 0;
      const move = nav.step(seenTime);
      if (move.done && !state.starTaken) {
        nav.setDestination(state.level.exit.x, state.level.exit.y);
      } else if (move.done && state.starTaken) {
        nav.setDestination(state.level.exit.x, state.level.exit.y);
      }
      const events = world.step(STEP, {
        mx: move.mx, my: move.my, smoke: move.smoke, toss: null, hack: false,
      }, false);
      if (events & EVENT_ESCAPED) {
        won = true;
        break;
      }
      if (events & EVENT_CAUGHT) break;
    }
    return { screen: won ? SCREEN_ESCAPED : endScreen(world, SCREEN_PLAY), best: world.state.score };
  }
  // start (and any unknown name): the title screen over a living gallery.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, idleInput(), true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

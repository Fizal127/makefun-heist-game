// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// gallery is scaled to fit the window and centred. Safe cover (the cases), danger (the
// cones) and loot (gold, and the cyan Star) are coloured so each reads at a glance,
// even shrunk to a contact sheet: the whole room is one frame, so every screenshot
// shows the room, the guards and their cones, the cameras, the loot and the alarm meter.
import { FIELD, FONT, PALETTE, THIEF, VISION } from './config.js';
import { EXIT_RADIUS } from './level.js';
import { cameraWatcher, canSee, guardWatcher } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_ESCAPED = 'escaped';

const TILE = 80;
const PANEL = { width: 660, line: 32 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let vignette = null;
  const scoreLabel = cachedLabel('SCORE ');
  const timeLabel = cachedLabel('');
  const bestLabel = cachedLabel('BEST ');
  const alarmLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    vignette = context.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.42,
      width / 2, height / 2, Math.max(width, height) * 0.75,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `600 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawFloor(state) {
    for (let ty = 0; ty < FIELD.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += TILE) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += TILE) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    for (const rug of state.level.decor) {
      context.fillStyle = rug.color;
      context.fillRect(rug.x, rug.y, rug.w, rug.h);
      context.strokeStyle = 'rgba(201,162,75,0.5)';
      context.lineWidth = 2;
      context.strokeRect(rug.x + 4, rug.y + 4, rug.w - 8, rug.h - 8);
    }
    // Walls: a dark border with a lighter top edge.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 24);
    context.fillRect(0, FIELD.height - 24, FIELD.width, 24);
    context.fillRect(0, 0, 24, FIELD.height);
    context.fillRect(FIELD.width - 24, 0, 24, FIELD.height);
    context.fillStyle = PALETTE.wallTop;
    context.fillRect(0, 22, FIELD.width, 2);
    context.fillRect(0, FIELD.height - 24, FIELD.width, 2);
    context.fillRect(22, 0, 2, FIELD.height);
    context.fillRect(FIELD.width - 24, 0, 2, FIELD.height);
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const pulse = state.starTaken ? 0.6 + 0.4 * Math.sin(state.time * 5) : 0;
    context.save();
    context.fillStyle = '#0f2a24';
    roundRect(exit.x - 52, exit.y - 16, 104, 32, 8);
    context.fill();
    context.strokeStyle = PALETTE.exit;
    context.lineWidth = 2 + pulse * 2;
    context.stroke();
    for (let i = -2; i <= 2; i += 1) {
      context.beginPath();
      context.moveTo(exit.x + i * 18, exit.y - 9);
      context.lineTo(exit.x + i * 18, exit.y + 9);
      context.stroke();
    }
    text('EXIT', exit.x, exit.y - 24, 13, state.starTaken ? PALETTE.exit : PALETTE.muted, 'center');
    context.restore();
  }

  function drawCases(state) {
    for (const c of state.level.cases) {
      context.fillStyle = PALETTE.caseDark;
      roundRect(c.x, c.y, c.w, c.h, 8);
      context.fill();
      context.fillStyle = PALETTE.caseGlass;
      roundRect(c.x + 5, c.y + 5, c.w - 10, c.h - 10, 6);
      context.fill();
      context.strokeStyle = PALETTE.caseTrim;
      context.lineWidth = 2;
      roundRect(c.x, c.y, c.w, c.h, 8);
      context.stroke();
      // A glass highlight across the top.
      context.strokeStyle = 'rgba(255,255,255,0.14)';
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(c.x + 12, c.y + c.h - 12);
      context.lineTo(c.x + c.w - 30, c.y + 12);
      context.stroke();
      text(c.label, c.x + c.w / 2, c.y + c.h / 2 + 5, 13, PALETTE.caseTrim, 'center');
    }
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const isStar = item.kind === 'star';
      const pulse = 0.7 + 0.3 * Math.sin(state.time * 3 + item.x);
      context.save();
      context.shadowColor = isStar ? PALETTE.star : PALETTE.gold;
      context.shadowBlur = isStar ? 26 : 14;
      context.fillStyle = isStar ? PALETTE.star : PALETTE.gold;
      const size = isStar ? 17 : 11;
      context.translate(item.x, item.y);
      context.rotate(Math.PI / 4);
      context.globalAlpha = pulse;
      context.fillRect(-size / 2, -size / 2, size, size);
      context.restore();
      context.save();
      context.globalAlpha = pulse;
      context.strokeStyle = isStar ? PALETTE.star : PALETTE.gold;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(item.x, item.y, (isStar ? 30 : 20) + Math.sin(state.time * 3) * 2, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      text(
        isStar ? 'AURORA STAR' : item.name.toUpperCase(),
        item.x, item.y + (isStar ? 46 : 34), 11,
        isStar ? PALETTE.star : PALETTE.gold, 'center',
      );
    }
  }

  function drawCone(x, y, angle, range, halfAngle, fill, edge) {
    context.save();
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
    context.stroke();
    context.restore();
  }

  function drawSmoke(state) {
    for (const cloud of state.smoke) {
      const fade = Math.min(1, cloud.t);
      context.save();
      context.globalAlpha = 0.55 * fade;
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(cloud.x - cloud.r * 0.4, cloud.y - cloud.r * 0.25, cloud.r * 0.55, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(cloud.x + cloud.r * 0.4, cloud.y + cloud.r * 0.3, cloud.r * 0.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    for (const coin of state.coins) {
      context.save();
      context.globalAlpha = Math.min(1, coin.t);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(coin.x, coin.y, 12, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(coin.x, coin.y, 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      if (!camera.disabled) {
        drawCone(
          camera.x, camera.y, camera.angle, VISION.cameraRange, VISION.cameraHalfAngle,
          PALETTE.coneCamera, PALETTE.coneCameraEdge,
        );
      }
      // Wall mount and lens.
      context.save();
      context.fillStyle = camera.disabled ? PALETTE.cameraOff : '#2a3040';
      context.beginPath();
      context.arc(camera.x, camera.y, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = camera.disabled ? PALETTE.cameraOff : PALETTE.camera;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = camera.disabled ? PALETTE.cameraOff : PALETTE.camera;
      context.beginPath();
      context.arc(
        camera.x + Math.cos(camera.angle) * 7, camera.y + Math.sin(camera.angle) * 7, 4, 0, Math.PI * 2,
      );
      context.fill();
      if (camera.disabled) {
        text('OFF', camera.x, camera.y - 20, 11, PALETTE.cameraOff, 'center');
      } else if (camera.hackProgress > 0) {
        context.strokeStyle = PALETTE.camera;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(camera.x, camera.y, 19, -Math.PI / 2, -Math.PI / 2 + (camera.hackProgress / 1.5) * Math.PI * 2);
        context.stroke();
        text('HACKING', camera.x, camera.y - 20, 11, PALETTE.camera, 'center');
      }
      context.restore();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      drawCone(
        guard.x, guard.y, guard.angle, VISION.guardRange, VISION.guardHalfAngle,
        PALETTE.coneGuard, PALETTE.coneGuardEdge,
      );
    }
    for (const guard of state.guards) {
      const chasing = guard.mode === 'chase';
      const investigating = guard.mode === 'investigate';
      context.save();
      context.fillStyle = PALETTE.guardBody;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = chasing ? PALETTE.guard : '#5a6274';
      context.lineWidth = chasing ? 3 : 2;
      context.stroke();
      // Facing tick and cap.
      context.strokeStyle = '#dfe4ee';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (guard.radius + 6), guard.y + Math.sin(guard.angle) * (guard.radius + 6));
      context.stroke();
      context.fillStyle = chasing ? PALETTE.guard : '#8b93a3';
      context.beginPath();
      context.arc(guard.x, guard.y - 4, 6, Math.PI, 0);
      context.fill();
      if (chasing) text('!', guard.x, guard.y - guard.radius - 8, 22, PALETTE.guard, 'center');
      else if (investigating) text('?', guard.x, guard.y - guard.radius - 8, 20, PALETTE.gold, 'center');
      context.restore();
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const seen = state.guards.some((g) => canSee(guardWatcher(g), thief, state.level.cases, state.smoke))
      || state.cameras.some((c) => !c.disabled && canSee(cameraWatcher(c), thief, state.level.cases, state.smoke));
    context.save();
    // A red sight-line from any watcher that has the thief in its cone.
    if (seen) {
      context.strokeStyle = 'rgba(229,83,75,0.8)';
      context.lineWidth = 2;
      for (const guard of state.guards) {
        if (canSee(guardWatcher(guard), thief, state.level.cases, state.smoke)) {
          context.beginPath();
          context.moveTo(guard.x, guard.y);
          context.lineTo(thief.x, thief.y);
          context.stroke();
        }
      }
      for (const camera of state.cameras) {
        if (!camera.disabled && canSee(cameraWatcher(camera), thief, state.level.cases, state.smoke)) {
          context.beginPath();
          context.moveTo(camera.x, camera.y);
          context.lineTo(thief.x, thief.y);
          context.stroke();
        }
      }
    }
    context.fillStyle = PALETTE.thiefDark;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius - 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#0a0d14';
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(thief.x, thief.y);
    context.lineTo(thief.x + Math.cos(thief.angle) * (thief.radius + 5), thief.y + Math.sin(thief.angle) * (thief.radius + 5));
    context.stroke();
    if (seen) {
      context.strokeStyle = PALETTE.guard;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(thief.x, thief.y, thief.radius + 5, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function alarmColor(value) {
    if (value >= 70) return PALETTE.alarmHigh;
    if (value >= 35) return PALETTE.alarmMid;
    return PALETTE.alarmLow;
  }

  function drawHud(state) {
    // Score and time, top left.
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 34, 16, 24, PALETTE.text, 'left');
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    text(
      timeLabel(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`),
      34, 46, 16, PALETTE.muted, 'left',
    );
    // The alarm meter, top centre: the one number the whole heist turns on.
    const barX = FIELD.width / 2 - 190;
    const barY = 14;
    const barW = 380;
    const barH = 22;
    context.fillStyle = 'rgba(10,13,20,0.78)';
    roundRect(barX - 64, barY - 6, barW + 128, barH + 12, 8);
    context.fill();
    text('ALARM', barX - 56, barY + 4, 15, alarmColor(state.alarm), 'left');
    context.fillStyle = '#0a0d14';
    context.fillRect(barX, barY, barW, barH);
    context.fillStyle = alarmColor(state.alarm);
    const fillW = Math.round((barW * state.alarm) / 100);
    if (fillW > 0) context.fillRect(barX, barY, fillW, barH);
    context.strokeStyle = '#3d4560';
    context.lineWidth = 2;
    context.strokeRect(barX, barY, barW, barH);
    text(alarmLabel(`${Math.floor(state.alarm)}%`), barX + barW + 8, barY + 4, 15, PALETTE.text, 'left');
    if (state.alarm >= 100) {
      const blink = 0.6 + 0.4 * Math.sin(state.time * 8);
      context.save();
      context.globalAlpha = blink;
      text('ALARM!', FIELD.width / 2, barY + barH + 22, 20, PALETTE.alarmHigh, 'center');
      context.restore();
    }
    // Loot pips and tools, top right.
    let px = FIELD.width - 34;
    const star = state.loot.find((item) => item.kind === 'star');
    context.save();
    context.translate(px - 10, 26);
    context.rotate(Math.PI / 4);
    context.fillStyle = star && star.taken ? PALETTE.star : 'rgba(143,232,255,0.25)';
    context.fillRect(-8, -8, 16, 16);
    context.restore();
    px -= 34;
    for (const item of state.loot) {
      if (item.kind === 'star') continue;
      context.save();
      context.translate(px - 8, 26);
      context.rotate(Math.PI / 4);
      context.fillStyle = item.taken ? PALETTE.gold : 'rgba(242,201,76,0.25)';
      context.fillRect(-6, -6, 12, 12);
      context.restore();
      px -= 28;
    }
    text(`SMOKE ${state.tools.smoke}`, px - 8, 18, 15, state.tools.smoke > 0 ? PALETTE.text : PALETTE.muted, 'right');
    text(`COINS ${state.tools.coins}`, px - 8, 40, 15, state.tools.coins > 0 ? PALETTE.text : PALETTE.muted, 'right');
    // The hint line, bottom left.
    text(
      'WASD move · Click: toss coin · 1: smoke · E (hold): hack camera · P: pause',
      34, FIELD.height - 40, 14, PALETTE.muted, 'left',
    );
    // A red edge when the alarm is hot.
    if (state.alarm > 55) {
      const pulse = 0.12 + 0.1 * Math.sin(state.time * 6);
      context.save();
      context.globalAlpha = pulse + (state.alarm / 100) * 0.25;
      context.strokeStyle = PALETTE.alarmHigh;
      context.lineWidth = 10;
      context.strokeRect(5, 5, FIELD.width - 10, FIELD.height - 10);
      context.restore();
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 150 + lines.length * PANEL.line + 64;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.save();
    context.fillStyle = 'rgba(10,13,20,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 66, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 118 + index * PANEL.line, 19, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 21, PALETTE.gold, 'center');
    context.restore();
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawExit(state);
    drawCases(state);
    drawLoot(state);
    drawSmoke(state);
    drawCameras(state);
    drawGuards(state);
    drawThief(state);
    if (vignette) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = vignette;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    }
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'VAULTBREAK',
        [
          'The Gilded Gallery, 2 a.m. Lift the Aurora Star and slip out the vent.',
          'Guards walk the hall and cameras sweep it — stay out of the cones.',
          'Click to toss a coin and pull a guard away · 1 for smoke · hold E to hack a camera.',
          `Best getaway: ${best} points`,
        ],
        'Press Space or click to start the heist',
        PALETTE.gold,
      );
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to keep stealing');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel(
        'CAUGHT!',
        [`Score ${state.score}`, `Best ${best}`, 'The gallery keeps its Star — this time.'],
        'Press Space or click to try again',
        PALETTE.alarmHigh,
      );
    } else if (screen === SCREEN_ESCAPED) {
      drawPanel(
        'CLEAN GETAWAY',
        [
          `Score ${state.score}${state.alarmTripped ? '' : '  (includes a +400 clean bonus)'}`,
          `Best ${best}`,
          'The Aurora Star is gone, and nobody saw a thing.',
        ],
        'Press Space or click to run it again',
        PALETTE.gold,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Client (mouse) coordinates to field coordinates, or null outside the field. */
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const px = (clientX - rect.left) * ratio;
      const py = (clientY - rect.top) * ratio;
      const fx = (px - view.x) / view.scale;
      const fy = (py - view.y) / view.scale;
      if (fx < 0 || fy < 0 || fx > FIELD.width || fy > FIELD.height) return null;
      return { x: fx, y: fy };
    },
  };
}

// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and escaped.
//
// ?seed=N is accepted for repeatability. ?shot=start|room|alarm|escape (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_COIN, EVENT_ESCAPED, EVENT_HACK, EVENT_LOOT, EVENT_SMOKE, EVENT_STAR } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_ESCAPED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let alarmBeepIn = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    alarmBeepIn = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Aurora Star and slip out the vent.');
  }

  function endGame(escaped) {
    screen = escaped ? SCREEN_ESCAPED : SCREEN_BUSTED;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      escaped
        ? `Clean getaway. Score ${world.state.score}. Best ${best}.`
        : `Caught. Score ${world.state.score}. Best ${best}.`,
    );
  }

  function handleEvents(events) {
    if (events & EVENT_LOOT) audio.pickup();
    if (events & EVENT_STAR) audio.star();
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_SMOKE) audio.smoke();
    if (events & EVENT_HACK) audio.hack();
    if (events & EVENT_ALARM) audio.alarm();
    if (events & EVENT_CAUGHT) {
      audio.caught();
      endGame(false);
    } else if (events & EVENT_ESCAPED) {
      audio.win();
      endGame(true);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicks = input.takeClicks();
    if (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_ESCAPED) {
      if ((actions & ACTION_CONFIRM) || clicks.length > 0) startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    // While playing, a click tosses a coin at that spot (one per frame, the first).
    if (clicks.length > 0) {
      const point = clicks[0];
      if (world.state.tools.coins > 0) {
        handleEvents(world.step(STEP, { mx: 0, my: 0, smoke: false, toss: point, hack: false }, false));
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, smoke: false, toss: null, hack: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const events = world.step(
      STEP,
      { mx: move.mx, my: move.my, smoke: input.takeSmoke(), toss: null, hack: input.hackHeld() },
      false,
    );
    // A short beep while the meter runs hot, so the alarm is heard as well as seen.
    if (world.state.alarm > 60) {
      alarmBeepIn -= STEP;
      if (alarmBeepIn <= 0) {
        audio.alarm();
        alarmBeepIn = 0.6;
      }
    }
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Vaultbreak. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

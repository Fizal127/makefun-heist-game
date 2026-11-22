// Keyboard and mouse input. Held keys give a move vector; one-shot presses (smoke,
// pause, confirm) are queued as flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. Clicks are queued with their
// position in field coordinates, and the loop decides what a click means on each
// screen: confirm on the title and end screens, toss a coin while playing.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SMOKE = new Set(['Digit1', 'KeyQ']);
const HACK = new Set(['KeyE']);

export function createInput(canvas, toField) {
  const held = { up: false, down: false, left: false, right: false, hack: false };
  let actions = 0;
  let smokeQueued = false;
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (HACK.has(event.code)) held.hack = true;
    else if (SMOKE.has(event.code)) {
      if (!event.repeat) smokeQueued = true;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (HACK.has(event.code)) held.hack = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.hack = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    if (point) clicks.push(point);
  });

  return {
    /** The move vector from the held keys, each component -1, 0 or 1. */
    move() {
      return {
        mx: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        my: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    hackHeld() {
      return held.hack;
    },
    /** True once if the smoke key was pressed since the last call. */
    takeSmoke() {
      const taken = smokeQueued;
      smokeQueued = false;
      return taken;
    },
    /** The clicks since the last call, as {x, y} points in field coordinates. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

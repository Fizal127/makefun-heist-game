// The Gilded Gallery, one room, one frame: the thief enters through the skylight vent
// at the south wall, crosses the hall past the display cases, and lifts the Aurora Star
// from its pedestal in the north wing. The cases are cover: they block movement and sight,
// so the hall offers a left route, a right route and a risky straight run up the middle.
import { FIELD, WALL } from './config.js';

export const EXIT_RADIUS = 36;

export function createLevel() {
  const cases = [
    // North pair: the corridor up to the Star runs between them.
    { x: 420, y: 150, w: 100, h: 80, label: 'VASES' },
    { x: 760, y: 150, w: 100, h: 80, label: 'VASES' },
    // Central islands: the two wings of the hall.
    { x: 250, y: 280, w: 170, h: 90, label: 'ARMOURY' },
    { x: 860, y: 280, w: 170, h: 90, label: 'ARMOURY' },
    // The sculpture in the middle of the hall: the one piece of cover on the
    // straight run up the centre, so a thief can break a cone's line of sight.
    { x: 590, y: 330, w: 100, h: 70, label: 'SCULPTURE' },
    // South pair: cover on the way back to the vent.
    { x: 150, y: 470, w: 160, h: 80, label: 'COINS' },
    { x: 970, y: 470, w: 160, h: 80, label: 'COINS' },
  ];

  const loot = [
    { x: 120, y: 200, kind: 'side', name: 'Sunset Canvas', taken: false },
    { x: 1160, y: 200, kind: 'side', name: 'Gold Idol', taken: false },
    { x: 640, y: 430, kind: 'side', name: 'Emerald Brooch', taken: false },
    { x: 640, y: 110, kind: 'star', name: 'Aurora Star', taken: false },
  ];

  // Rugs and the central runner: decoration only, drawn under everything.
  const decor = [
    { x: 560, y: 240, w: 160, h: 420, color: '#5a2e35' },
    { x: 120, y: 330, w: 110, h: 120, color: '#2e3a5a' },
    { x: 1050, y: 330, w: 110, h: 120, color: '#2e3a5a' },
  ];

  const guards = [
    {
      name: 'Mara',
      waypoints: [
        { x: 350, y: 450 },
        { x: 930, y: 450 },
      ],
    },
    {
      name: 'Dmitri',
      waypoints: [
        { x: 300, y: 180 },
        { x: 980, y: 180 },
      ],
    },
    {
      name: 'Ivo',
      waypoints: [
        { x: 150, y: 600 },
        { x: 1130, y: 600 },
      ],
    },
  ];

  const cameras = [
    // North wall, looking down over the west approach to the Star.
    { x: 300, y: WALL.thickness + 6, angle: Math.PI / 2 },
    // East wall, looking left across the central hall.
    { x: FIELD.width - WALL.thickness - 6, y: 360, angle: Math.PI },
  ];

  return {
    cases,
    loot,
    decor,
    guards,
    cameras,
    exit: { x: 640, y: 668, r: EXIT_RADIUS },
    thiefStart: { x: 640, y: 625 },
    bounds: {
      minX: WALL.thickness,
      minY: WALL.thickness,
      maxX: FIELD.width - WALL.thickness,
      maxY: FIELD.height - WALL.thickness,
    },
  };
}

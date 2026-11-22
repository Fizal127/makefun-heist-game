// VAULTBREAK — The Gilded Gallery: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

// The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

// The gallery walls: a border the thief and the guards never leave.
export const WALL = { thickness: 24 };

export const THIEF = {
  radius: 14,
  speed: 185,
  // How close the thief must be to pick something up.
  grabRadius: 34,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 78,
  chaseSpeed: 125,
  // Seconds a guard keeps chasing the last seen spot after losing sight.
  chaseMemory: 2.5,
  // Seconds a guard spends inspecting a tossed coin before going back on patrol.
  investigateTime: 4,
  // How close a guard must get to catch the thief.
  catchRadius: 24,
};

export const VISION = {
  guardRange: 200,
  guardHalfAngle: 0.55, // ~63 degrees of cone
  cameraRange: 230,
  cameraHalfAngle: 0.44, // ~50 degrees of cone
  // Alarm points per second while the thief is seen.
  guardAlarmRate: 45,
  cameraAlarmRate: 32,
  // Alarm points per second while nobody sees the thief.
  decayRate: 16,
  // Grabbing the Aurora Star adds this much alarm at once.
  starAlarmJump: 25,
};

export const CAMERA = {
  // Seconds of holding E beside a camera to switch it off.
  hackSeconds: 1.5,
  // Seconds a hacked camera stays dark.
  disabledSeconds: 12,
  // How close the thief must stand to hack.
  hackRadius: 78,
  // Degrees the lens sweeps, each way, from its mount angle.
  sweepHalfAngle: 0.55,
  sweepSpeed: 0.55,
};

export const TOOLS = {
  smokeCount: 3,
  smokeRadius: 95,
  smokeSeconds: 5,
  coinCount: 5,
  // Guards inside this distance of a landed coin walk over to look.
  coinHearing: 330,
};

export const SCORE = {
  sideLoot: 150,
  star: 1000,
  // Clean bonus when the thief escapes without ever tripping the full alarm.
  cleanBonus: 400,
};

export const BEST_KEY = 'vaultbreak.best';

export const PALETTE = {
  backdrop: '#0a0d14',
  floorA: '#171b26',
  floorB: '#1c212e',
  floorLine: '#232838',
  wall: '#2e3448',
  wallTop: '#3d4560',
  caseGlass: '#233246',
  caseTrim: '#c9a24b',
  caseDark: '#1a2436',
  gold: '#f2c94c',
  goldDeep: '#c9a24b',
  star: '#8fe8ff',
  thief: '#37d6b4',
  thiefDark: '#1f8f78',
  guard: '#e5534b',
  guardBody: '#3a4158',
  coneGuard: 'rgba(229, 83, 75, 0.20)',
  coneGuardEdge: 'rgba(229, 83, 75, 0.55)',
  coneCamera: 'rgba(242, 201, 76, 0.16)',
  coneCameraEdge: 'rgba(242, 201, 76, 0.45)',
  camera: '#f2c94c',
  cameraOff: '#5a6274',
  smoke: 'rgba(180, 190, 205, 0.55)',
  exit: '#37d6b4',
  panel: '#141824',
  panelEdge: '#2e3448',
  text: '#eef1f5',
  muted: '#9aa3b5',
  alarmLow: '#37d6b4',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

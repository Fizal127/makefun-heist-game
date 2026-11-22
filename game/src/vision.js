// Sight and sound in the gallery: what a guard or a camera can see, and what smoke
// hides. Everything here is pure geometry — no drawing, no browser — so the simulation
// and the screenshots agree about every cone.
import { VISION } from './config.js';

export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the segment from (x1,y1) to (x2,y2) touches the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when nothing between the watcher and the point blocks the view. */
export function hasLineOfSight(x1, y1, x2, y2, cases) {
  for (let i = 0; i < cases.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, cases[i])) return false;
  }
  return true;
}

/** True when the point lies inside a smoke cloud. */
export function insideSmoke(x, y, smoke) {
  for (let i = 0; i < smoke.length; i += 1) {
    const cloud = smoke[i];
    const dx = x - cloud.x;
    const dy = y - cloud.y;
    if (dx * dx + dy * dy < cloud.r * cloud.r) return true;
  }
  return false;
}

/** True when the watcher's sight line to the point crosses any smoke cloud. */
export function sightCrossesSmoke(x1, y1, x2, y2, smoke) {
  for (let i = 0; i < smoke.length; i += 1) {
    const cloud = smoke[i];
    // Distance from the cloud centre to the segment.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((cloud.x - x1) * dx + (cloud.y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    const ddx = cloud.x - cx;
    const ddy = cloud.y - cy;
    if (ddx * ddx + ddy * ddy < cloud.r * cloud.r) return true;
  }
  return false;
}

/**
 * Can this watcher see the thief? Range, cone angle, cases in the way and smoke all
 * count. `watcher` is {x, y, angle, range, halfAngle}.
 */
export function canSee(watcher, thief, cases, smoke) {
  const dx = thief.x - watcher.x;
  const dy = thief.y - watcher.y;
  const distSq = dx * dx + dy * dy;
  if (distSq > watcher.range * watcher.range) return false;
  const bearing = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(bearing, watcher.angle)) > watcher.halfAngle) return false;
  if (insideSmoke(thief.x, thief.y, smoke)) return false;
  if (sightCrossesSmoke(watcher.x, watcher.y, thief.x, thief.y, smoke)) return false;
  return hasLineOfSight(watcher.x, watcher.y, thief.x, thief.y, cases);
}

export function guardWatcher(guard) {
  return {
    x: guard.x,
    y: guard.y,
    angle: guard.angle,
    range: VISION.guardRange,
    halfAngle: VISION.guardHalfAngle,
  };
}

export function cameraWatcher(camera) {
  return {
    x: camera.x,
    y: camera.y,
    angle: camera.angle,
    range: VISION.cameraRange,
    halfAngle: VISION.cameraHalfAngle,
  };
}

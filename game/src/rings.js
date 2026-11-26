// Island Courier — the five delivery rings. A fixed route with a seeded jitter,
// flown in order: out along the coast, around the far islands, high past the
// mountain, then back down the runway approach. A ring counts when the plane's
// path crosses its plane inside the hoop, so a fast plane can never jump over
// one between two fixed steps (swept check, not a point test).
import { RING_RADIUS } from './config.js';
import { mulberry32 } from './terrain.js';

const WAYPOINTS = [
  { x: 420, y: 65, z: -60 },
  { x: 980, y: 95, z: -420 },
  { x: 1050, y: 120, z: 300 },
  { x: -200, y: 160, z: -420 },
  { x: -350, y: 70, z: 150 },
];

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function length(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}
function normalize(v) {
  const l = length(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function createRings(seed) {
  const rng = mulberry32(seed ^ 0x416);
  const start = { x: -190, y: 18, z: 0 };
  const list = [];
  for (let i = 0; i < WAYPOINTS.length; i += 1) {
    const w = WAYPOINTS[i];
    const ring = {
      x: w.x + (rng() * 2 - 1) * 40,
      y: w.y + (rng() * 2 - 1) * 10,
      z: w.z + (rng() * 2 - 1) * 40,
      radius: RING_RADIUS,
    };
    // The leg this ring is approached on: from the previous ring (or the
    // runway start for ring 1). The hoop faces the incoming plane.
    const from = i === 0 ? start : list[i - 1];
    ring.from = { x: from.x, y: from.y, z: from.z };
    ring.axis = normalize(sub(ring, from));
    list.push(ring);
  }

  let next = 0;
  let passed = 0;

  function nextRing() {
    return next < list.length ? list[next] : null;
  }

  // Swept segment-vs-plane test: did the path cross this ring's plane, and
  // was the crossing point inside the hoop?
  function checkPass(prev, pos) {
    if (next >= list.length) return false;
    const ring = list[next];
    const d0 = dot(sub(prev, ring), ring.axis);
    const d1 = dot(sub(pos, ring), ring.axis);
    // The axis points along the approach, from the previous point toward the
    // ring and beyond: the plane is on the negative side coming in and on
    // the positive side after it crosses the hoop's plane.
    if (!(d0 < 0 && d1 >= 0)) return false;
    const t = d0 / (d0 - d1);
    const cross = {
      x: prev.x + (pos.x - prev.x) * t,
      y: prev.y + (pos.y - prev.y) * t,
      z: prev.z + (pos.z - prev.z) * t,
    };
    if (length(sub(cross, ring)) < ring.radius * 0.95) {
      next += 1;
      passed += 1;
      return true;
    }
    return false;
  }

  function reset() {
    next = 0;
    passed = 0;
  }

  return { list, nextRing, checkPass, reset, get next() { return next; }, get passed() { return passed; } };
}

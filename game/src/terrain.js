// Island Courier — the seeded tropical world. Pure numbers, no three.js here,
// so the flight model, the renderer and a headless test all read the same
// ground: one seeded RNG, one height function, one source of truth.
import { RUNWAY, SEA_LEVEL } from './config.js';

// Small deterministic PRNG (mulberry32): one seed, one world, every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let n = (ix * 374761393 + iz * 668265263 + seed * 974634) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Value noise in -1..1, sampled at non-integer frequencies so lattice points
// never flatten out.
function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

function fbm(x, z, seed) {
  return (
    valueNoise(x, z, seed) * 0.55 +
    valueNoise(x * 2.13, z * 2.13, seed + 7) * 0.3 +
    valueNoise(x * 4.31, z * 4.31, seed + 13) * 0.15
  );
}

const ISLANDS = [
  { x: 0, z: 0, r: 850, base: 10, peak: 55 }, // home island, holds the runway
  { x: 1000, z: -450, r: 380, base: 6, peak: 70 },
  { x: -750, z: 650, r: 320, base: 6, peak: 60 },
  { x: 600, z: 700, r: 150, base: 4, peak: 25 },
];
const MOUNTAIN = { x: -560, z: -520, peak: 95, spread: 170 };

export function createTerrain(seed) {
  function islandHeight(x, z) {
    let h = -6; // seabed
    for (let i = 0; i < ISLANDS.length; i += 1) {
      const isl = ISLANDS[i];
      const dx = x - isl.x;
      const dz = z - isl.z;
      const d = Math.sqrt(dx * dx + dz * dz) / isl.r;
      if (d >= 1) continue;
      const shape = Math.pow(1 - d * d, 1.2);
      const rough = 0.72 + 0.28 * fbm(x * 0.006, z * 0.006, seed);
      h = Math.max(h, (isl.base + isl.peak * rough) * shape);
    }
    const mdx = x - MOUNTAIN.x;
    const mdz = z - MOUNTAIN.z;
    h += MOUNTAIN.peak * Math.exp(-(mdx * mdx + mdz * mdz) / (2 * MOUNTAIN.spread * MOUNTAIN.spread));
    return h;
  }

  // Flatten the ground under the runway strip so landings are fair.
  function heightAt(x, z) {
    let h = islandHeight(x, z);
    const rx = Math.abs(x - RUNWAY.centre.x);
    const rz = Math.abs(z - RUNWAY.centre.z);
    if (rx < 320 && rz < 115) {
      const tx = smooth(Math.max(0, Math.min(1, (320 - rx) / 60)));
      const tz = smooth(Math.max(0, Math.min(1, (115 - rz) / 60)));
      const t = Math.min(tx, tz);
      h += (RUNWAY.elevation - h) * t;
    }
    return h;
  }

  function inRunwayRect(x, z, margin) {
    return Math.abs(x) < RUNWAY.length / 2 + margin && Math.abs(z) < RUNWAY.width / 2 + margin;
  }

  // Palm spots: seeded, on dry gentle ground, clear of the runway.
  const treeSpots = [];
  const rng = mulberry32(seed ^ 0x7e55);
  for (let i = 0; i < 900 && treeSpots.length < 260; i += 1) {
    const x = (rng() * 2 - 1) * 1300;
    const z = (rng() * 2 - 1) * 1300;
    const h = heightAt(x, z);
    if (h < 5 || h > 55 || inRunwayRect(x, z, 60)) continue;
    if (Math.abs(heightAt(x + 6, z) - h) > 3 || Math.abs(heightAt(x, z + 6) - h) > 3) continue;
    treeSpots.push({ x, y: h, z, scale: 0.8 + rng() * 0.9 });
  }

  const cloudSpots = [];
  const crng = mulberry32(seed ^ 0xc10d);
  for (let i = 0; i < 16; i += 1) {
    cloudSpots.push({
      x: (crng() * 2 - 1) * 1600,
      y: 190 + crng() * 90,
      z: (crng() * 2 - 1) * 1600,
      scale: 30 + crng() * 55,
    });
  }

  return { seed, heightAt, seaLevel: SEA_LEVEL, runway: RUNWAY, treeSpots, cloudSpots, islands: ISLANDS };
}

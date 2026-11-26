// Island Courier — tuning constants. One place for every number the flight
// model, the world and the HUD agree on, so a tweak lands everywhere at once.
export const STEP = 1 / 120;
export const DEFAULT_SEED = 20261126;
export const SEA_LEVEL = 0;
export const BEST_KEY = 'island-courier-best';

export const RUNWAY = {
  elevation: 16,
  length: 440,
  width: 26,
  heading: Math.PI / 2, // takeoff heading: +X along the strip
  centre: { x: 0, z: 0 },
};

export const PLANE = {
  maxSpeed: 85, // m/s, about 165 knots
  stallSpeed: 24,
  accel: 14, // m/s^2 spooling up
  decel: 22, // m/s^2 spooling down
  maxBank: 0.85, // radians, about 49 degrees
  bankRate: 2.2, // radians per second toward the target bank
  maxPitch: 0.42, // radians, about 24 degrees
  pitchRate: 1.5,
  gearHeight: 2.2, // metres from ground to the plane origin on its wheels
};

export const FUEL = { capacity: 200, idleBurn: 0.2, fullBurn: 0.7 }; // per second

export const RING_RADIUS = 20;
export const RING_SCORE = 400;

// Cannon: tracer speed, life and the pause between shots; a target balloon
// is worth this many points on top of the ring score.
export const WEAPON = { speed: 220, life: 1.2, cooldown: 0.18, tracerLength: 3.2 };
export const TARGET_SCORE = 250;
export const TARGET_RADIUS = 6;

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASH = 4;
export const EVENT_COMPLETE = 8;
export const EVENT_FUEL_EMPTY = 16;
export const EVENT_TAKEOFF = 32;

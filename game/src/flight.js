// Island Courier — the arcade flight model. Fixed 120 Hz steps only: throttle
// spools, bank drives a coordinated turn, pitch trades speed for altitude,
// and below stall speed the plane sinks and its nose drops. Ground contact is
// read from the same height function the terrain is drawn from, so what you
// see is what you land on.
import {
  STEP, PLANE, FUEL, RUNWAY,
  EVENT_RING, EVENT_LANDED, EVENT_CRASH, EVENT_COMPLETE, EVENT_FUEL_EMPTY, EVENT_TAKEOFF,
} from './config.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createFlight(terrain, rings) {
  const start = {
    x: -190,
    y: RUNWAY.elevation + PLANE.gearHeight,
    z: 0,
  };
  const state = {
    pos: { ...start },
    heading: RUNWAY.heading,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: FUEL.capacity,
    damage: 0,
    status: 'ready', // ready | flying | landed | crashed | complete
    onGround: true,
    ringsPassed: 0,
    score: 0,
    time: 0,
    fuelEmpty: false,
  };

  function reset() {
    state.pos = { ...start };
    state.heading = RUNWAY.heading;
    state.pitch = 0;
    state.bank = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = FUEL.capacity;
    state.damage = 0;
    state.status = 'ready';
    state.onGround = true;
    state.ringsPassed = 0;
    state.score = 0;
    state.time = 0;
    state.fuelEmpty = false;
  }

  function onRunway(x, z) {
    return Math.abs(x - RUNWAY.centre.x) <= RUNWAY.length / 2 && Math.abs(z - RUNWAY.centre.z) <= RUNWAY.width / 2 + 4;
  }

  // One fixed step. `input` is { throttleUp, throttleDown, turn, pitch } with
  // turn/pitch in -1..1. Returns an event bitmask.
  function step(dt, input) {
    if (state.status === 'crashed' || state.status === 'complete') return 0;
    let events = 0;
    if (state.status === 'ready') state.status = 'flying';

    // Throttle spools toward the pilot's demand; a dry tank means no thrust.
    if (state.fuel <= 0) state.throttle = 0;
    else {
      const demand = (input.throttleUp ? 0.7 : 0) - (input.throttleDown ? 0.9 : 0);
      state.throttle = clamp(state.throttle + demand * dt, 0, 1);
    }

    const targetSpeed = state.throttle * PLANE.maxSpeed;
    if (state.speed < targetSpeed) state.speed = Math.min(targetSpeed, state.speed + PLANE.accel * dt);
    else state.speed = Math.max(targetSpeed, state.speed - PLANE.decel * dt);

    // Bank toward the target, then turn at the coordinated rate for that bank.
    const bankTarget = input.turn * PLANE.maxBank * (state.onGround ? 0.4 : 1);
    state.bank += clamp(bankTarget - state.bank, -PLANE.bankRate * dt, PLANE.bankRate * dt);
    let yawRate = (9.81 * Math.tan(state.bank)) / Math.max(state.speed, 14);
    yawRate = clamp(yawRate, -0.55, 0.55);
    state.heading += yawRate * dt * (state.onGround ? 0.35 : 1);

    // Pitch toward the target; below stall the nose drops on its own.
    let pitchTarget = state.onGround && state.speed < 26 ? 0 : input.pitch * PLANE.maxPitch;
    if (!state.onGround && state.speed < PLANE.stallSpeed * 0.8) pitchTarget = Math.min(pitchTarget, -0.12);
    state.pitch += clamp(pitchTarget - state.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);

    const cp = Math.cos(state.pitch);
    const forward = {
      x: cp * Math.sin(state.heading),
      y: Math.sin(state.pitch),
      z: cp * Math.cos(state.heading),
    };
    const prev = { ...state.pos };
    state.pos.x += forward.x * state.speed * dt;
    state.pos.y += forward.y * state.speed * dt;
    state.pos.z += forward.z * state.speed * dt;
    // Sinking below stall speed: gentle, survivable, but it will catch you.
    if (!state.onGround && state.speed < PLANE.stallSpeed) {
      state.pos.y -= (PLANE.stallSpeed - state.speed) * 0.55 * dt;
    }

    if (state.onGround) {
      state.pos.y = terrain.heightAt(state.pos.x, state.pos.z) + PLANE.gearHeight;
      if (state.speed > 26) {
        state.onGround = false;
        events |= EVENT_TAKEOFF;
      }
    }

    state.fuel = Math.max(0, state.fuel - (FUEL.idleBurn + state.throttle * FUEL.fullBurn) * dt);
    if (state.fuel <= 0 && !state.fuelEmpty) {
      state.fuelEmpty = true;
      events |= EVENT_FUEL_EMPTY;
    }

    if (!state.onGround) {
      const ground = terrain.heightAt(state.pos.x, state.pos.z);
      // Strictly below: the liftoff step leaves the plane exactly at gear
      // height, and that step must not count as a touchdown or the plane
      // would bounce between liftoff and landing forever.
      if (state.pos.y < ground + PLANE.gearHeight) {
        const verticalSpeed = -(forward.y * state.speed) + (state.speed < PLANE.stallSpeed ? (PLANE.stallSpeed - state.speed) * 0.55 : 0);
        const gentle = verticalSpeed < 7 && Math.abs(state.bank) < 0.35 && Math.abs(state.pitch) < 0.25 && state.speed > 8;
        if (onRunway(state.pos.x, state.pos.z) && gentle) {
          state.pos.y = ground + PLANE.gearHeight;
          state.onGround = true;
          state.speed *= 0.35;
          if (state.ringsPassed >= 5) {
            state.status = 'complete';
            events |= EVENT_COMPLETE;
          } else {
            state.fuel = FUEL.capacity; // touch-and-go: refuelled, take off again
            events |= EVENT_LANDED;
          }
        } else {
          state.pos.y = ground + PLANE.gearHeight;
          state.damage = 100;
          state.status = 'crashed';
          events |= EVENT_CRASH;
        }
      }
    }

    if (state.status === 'flying' && !state.onGround) {
      if (rings.checkPass(prev, state.pos)) {
        state.ringsPassed += 1;
        state.score += 400 + Math.round(state.fuel);
        events |= EVENT_RING;
      }
    }

    if (state.speed > 1) state.time += dt;
    return events;
  }

  return { state, step, reset };
}

// Re-exported so render/main can read the step without importing config.
export { STEP };

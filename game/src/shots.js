// Island Courier — the screenshot scenes behind ?shot=cover|runway|turn|landing.
// Each one plays the real rules forward from a fresh world for a fixed stretch,
// steered by a simple autopilot (aim at the next ring, hold a glide slope to
// the runway), so the frame is what a short game really looks like and the
// same seed always gives the same frame. The cover scene also fires the cannon
// at the first balloon on the route, so the frame catches the explosion at its
// peak. cover2 and turn2 are alternate moments of the same scenes, used as
// candidates when picking the four best frames.
import { STEP } from './config.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Steer toward `target` at `throttleTarget`: turn to the bearing, pitch to
// the altitude error, throttle to the target. On the ground, hold the runway
// centreline straight ahead instead of turning toward the ring. Near a ring
// (slowNear) it throttles back so the turn radius shrinks enough to thread
// the hoop — at full speed the coordinated turn is far too wide — and it
// follows the approach leg (aiming ahead of its projection on the leg line)
// instead of pure-pursuing the hoop, which would orbit it forever.
function autopilotInput(flight, target, throttleTarget, slowNear, terrain) {
  const s = flight.state;
  let aim = target;
  if (slowNear && target.from && !s.onGround) {
    const fx = target.from.x;
    const fy = target.from.y;
    const fz = target.from.z;
    const lx = target.x - fx;
    const ly = target.y - fy;
    const lz = target.z - fz;
    const llen = Math.hypot(lx, ly, lz) || 1;
    const ux = lx / llen;
    const uy = ly / llen;
    const uz = lz / llen;
    const distToRing = Math.hypot(target.x - s.pos.x, target.y - s.pos.y, target.z - s.pos.z);
    if (distToRing > 60) {
      let t = (s.pos.x - fx) * ux + (s.pos.y - fy) * uy + (s.pos.z - fz) * uz;
      t = Math.max(0, Math.min(llen, t + 100));
      aim = { x: fx + ux * t, y: fy + uy * t, z: fz + uz * t };
    }
  } else if (s.onGround) {
    aim = { x: s.pos.x + 500, y: s.pos.y, z: 0 };
  }
  const dx = aim.x - s.pos.x;
  const dy = aim.y - s.pos.y;
  const dz = aim.z - s.pos.z;
  const dist = Math.hypot(dx, dz);
  const desiredHeading = Math.atan2(dx, dz);
  const turn = clamp(wrapAngle(desiredHeading - s.heading) * 3.0, -1, 1);
  const desiredPitch = clamp(Math.atan2(dy, Math.max(dist, 40)), -0.35, 0.35);
  const pitch = clamp((desiredPitch - s.pitch) * 2.5, -1, 1);
  const distToRing = Math.hypot(target.x - s.pos.x, target.y - s.pos.y, target.z - s.pos.z);
  // Fly the legs at a moderate cruise and bleed speed well before each
  // hoop: the turn after a ring is wide at full speed, and a fast plane
  // cannot line the next hoop up in the leg that follows.
  const cruise = slowNear && !s.onGround
    ? distToRing > 500 ? throttleTarget : distToRing > 300 ? 0.5 : distToRing > 150 ? 0.4 : 0.35
    : throttleTarget;
  const input = {
    throttleUp: s.throttle < cruise,
    throttleDown: s.throttle > cruise + 0.05,
    turn,
    pitch,
  };
  // Terrain clearance net, rings only: never trade the hillside for the
  // hoop. (Final approach runs with slowNear off, so it can still land.)
  if (slowNear && terrain && !s.onGround) {
    const ground = terrain.heightAt(s.pos.x, s.pos.z);
    if (s.pos.y < ground + 12) {
      input.throttleUp = true;
      input.throttleDown = false;
      input.pitch = 1;
    }
  }
  return input;
}

// Set `world` to the named scene and return the screen to draw over it.
export function stageShot(name, world) {
  world.reset();
  const flight = world.flight;
  const rings = world.rings;
  const weapons = world.weapons;

  function stepToward(target, throttleTarget, slowNear = true) {
    flight.step(STEP, autopilotInput(flight, target, throttleTarget, slowNear, world.terrain));
    weapons.update(STEP, flight.state);
  }
  function runFor(seconds, targetFn, throttleTarget = 0.62) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i += 1) {
      if (flight.state.status === 'crashed' || flight.state.status === 'complete') break;
      stepToward(targetFn(), throttleTarget);
    }
  }

  if (name === 'cover' || name === 'cover2') {
    // Closing on ring 2 over the sea, hoop ahead, islands below — and the
    // first balloon sits right on this leg, so the plane shoots it point
    // blank. The tracer needs ~0.3 s to cross the last metres and the
    // fireball blooms for ~0.4 s after that: the frame is taken at the
    // peak of the blast. cover2 runs three seconds longer, a later moment.
    const extra = name === 'cover2' ? 3 : 0;
    runFor(19 + extra, () => rings.nextRing() || { x: 0, y: 20, z: 0 });
    const target = weapons.targets[0];
    let fired = false;
    for (let i = 0; i < 10 / STEP; i += 1) {
      if (flight.state.status === 'crashed' || flight.state.status === 'complete') break;
      if (weapons.hits > 0) break;
      const next = rings.nextRing();
      const d = Math.hypot(
        target.x - flight.state.pos.x,
        target.y - flight.state.pos.y,
        target.z - flight.state.pos.z,
      );
      // Inside 150 m, point the nose at the balloon itself so the tracer
      // flies straight into it — the ring can wait a second. Aiming at the
      // ring leaves the balloon ~20 degrees off the nose and the shot sails
      // past it.
      if (d < 150 && next) stepToward({ x: target.x, y: target.y, z: target.z }, 0.5, false);
      else if (next) stepToward(next, 0.62);
      else stepToward({ x: 0, y: 20, z: 0 }, 0.62);
      if (!fired && d < 75) {
        weapons.fire(flight.state);
        fired = true;
        // Let the tracer arrive and the explosion bloom.
        for (let j = 0; j < 0.7 / STEP; j += 1) {
          const n2 = rings.nextRing();
          if (n2) stepToward(n2, 0.62);
          else stepToward({ x: 0, y: 20, z: 0 }, 0.62);
        }
        break;
      }
    }
    return { screen: 'play' };
  }
  if (name === 'turn' || name === 'turn2') {
    // Banked turn between legs, mountains and the next ring ahead.
    // turn2 is five seconds earlier, mid-turn with a harder bank.
    runFor(name === 'turn2' ? 26 : 31, () => rings.nextRing() || { x: 0, y: 20, z: 0 });
    return { screen: 'play' };
  }
  if (name === 'runway') {
    // Fly the rings, then set up a long final from far west: fly out to
    // (-900, 70, 0), turn around, and come back down the centreline. The
    // final only starts once the plane is flying east and converged onto
    // the centreline; then it drops to 26 m and runs low down the asphalt.
    let phase = 'out';
    for (let i = 0; i < 240 / STEP; i += 1) {
      const st = flight.state.status;
      if (st === 'crashed' || st === 'complete') break;
      const next = rings.nextRing();
      if (next) stepToward(next, 0.62);
      else if (phase === 'out') {
        stepToward({ x: -900, y: 70, z: 0 }, 0.35, false);
        if (Math.hypot(-900 - flight.state.pos.x, flight.state.pos.z) < 150) phase = 'back';
      } else if (phase === 'back') {
        // Come back east toward a point just west of the strip: the plane
        // converges onto the centreline while it is still west of the
        // runway, so the final starts with room to descend.
        stepToward({ x: -300, y: 70, z: 0 }, 0.35, false);
        const headingEast = Math.abs(wrapAngle(flight.state.heading - Math.PI / 2)) < 0.5;
        if (headingEast && Math.abs(flight.state.pos.z) < 40 && flight.state.pos.x < -200) phase = 'final';
      } else {
        if (Math.abs(flight.state.pos.x) < 150 && flight.state.pos.y < 40) break;
        stepToward({ x: 200, y: 26, z: 0 }, 0.45, false);
      }
    }
    return { screen: 'play' };
  }
  // landing: fly the whole route, then set up a long final from far west
  // and ride it down to touchdown. The plane flies out to (-900, 70, 0),
  // turns, and comes back down the centreline; the final only starts once
  // it is flying east and converged onto the centreline, so it has a long
  // straight run to settle onto the strip. An overshoot just means
  // another circuit, not a crash.
  let phase = 'out';
  for (let i = 0; i < 300 / STEP; i += 1) {
    const st = flight.state.status;
    if (st === 'crashed' || st === 'complete') break;
    const next = rings.nextRing();
    if (next) stepToward(next, 0.62);
    else if (phase === 'out') {
      stepToward({ x: -900, y: 70, z: 0 }, 0.35, false);
      if (Math.hypot(-900 - flight.state.pos.x, flight.state.pos.z) < 150) phase = 'back';
    } else if (phase === 'back') {
      // Come back east toward a point just west of the strip: the plane
      // converges onto the centreline while it is still west of the
      // runway, so the final starts with room to descend.
      stepToward({ x: -300, y: 70, z: 0 }, 0.35, false);
      const headingEast = Math.abs(wrapAngle(flight.state.heading - Math.PI / 2)) < 0.5;
      if (headingEast && Math.abs(flight.state.pos.z) < 40 && flight.state.pos.x < -200) phase = 'final';
    } else {
      // On final: chase a carrot 100 m ahead on the centreline, descending
      // on a slope that ends below the strip, so the plane is firmly on
      // the asphalt well before the far end. The carrot moves with the
      // plane, so the nose always points back toward the strip and any
      // drift is corrected at once, instead of the plane flying a fixed
      // line and sliding off it.
      const carrotX = flight.state.pos.x + 100;
      const distToEnd = Math.max(0, 100 - flight.state.pos.x);
      const carrotY = 5 + distToEnd * 0.06;
      stepToward({ x: carrotX, y: carrotY, z: 0 }, 0.3, false);
    }
  }
  return { screen: flight.state.status === 'complete' ? 'complete' : 'play' };
}

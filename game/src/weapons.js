// Island Courier — cannon, target balloons and explosions. Three red-and-white
// balloons hang on the mission route (one on each of the first three legs),
// so a pilot flying the rings meets them head-on. A shot is a glowing tracer
// from the nose; a hit pops the balloon into a fireball: orange fire points,
// grey smoke, an expanding shockwave sphere and a hard light flash. Targets
// are a score bonus only — the five rings and the landing still decide the
// mission, and shooting never blocks them.
import * as THREE from 'three';
import { WEAPON, TARGET_SCORE, TARGET_RADIUS } from './config.js';

// Balloon stations: right on the legs between rings, so the autopilot and a
// human pilot both fly straight at them.
const TARGET_SPOTS = [
  { x: 700, y: 85, z: -240, phase: 0 },
  { x: 1015, y: 115, z: -60, phase: 2.1 },
  { x: 425, y: 145, z: -60, phase: 4.2 },
];

function roundSprite() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createWeapons(scene) {
  const sprite = roundSprite();
  const targets = [];
  const tracers = [];
  const explosions = [];
  let hits = 0;
  let lastFired = -10;
  let simTime = 0;
  let onHit = null;

  const red = new THREE.MeshStandardMaterial({ color: 0xe23b2e, roughness: 0.35, metalness: 0.1, flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.5, metalness: 0.05, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.2, flatShading: true });

  for (const spot of TARGET_SPOTS) {
    const group = new THREE.Group();
    const envelope = new THREE.Mesh(new THREE.SphereGeometry(TARGET_RADIUS, 14, 10), red);
    envelope.scale.set(1, 1.15, 1);
    group.add(envelope);
    const band = new THREE.Mesh(new THREE.TorusGeometry(TARGET_RADIUS * 0.99, 0.55, 8, 20), white);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.5;
    group.add(band);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), dark);
    basket.position.y = -TARGET_RADIUS - 2.4;
    group.add(basket);
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 5), dark);
    tether.position.y = -TARGET_RADIUS - 1.1;
    group.add(tether);
    group.position.set(spot.x, spot.y, spot.z);
    scene.add(group);
    targets.push({ group, baseY: spot.y, phase: spot.phase, alive: true, x: spot.x, y: spot.y, z: spot.z });
  }

  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const tracerGeo = new THREE.BoxGeometry(0.28, 0.28, WEAPON.tracerLength);
  for (let i = 0; i < 12; i += 1) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat);
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, alive: false, vx: 0, vy: 0, vz: 0, life: 0 });
  }

  function explode(pos) {
    // Fire: fast orange points that bloom and die within a second.
    const fireCount = 70;
    const firePos = new Float32Array(fireCount * 3);
    const fireCol = new Float32Array(fireCount * 3);
    const fireVel = [];
    for (let i = 0; i < fireCount; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const sp = 12 + Math.random() * 34;
      fireVel.push({
        x: Math.sin(b) * Math.cos(a) * sp,
        y: Math.cos(b) * sp * 0.9 + 6,
        z: Math.sin(b) * Math.sin(a) * sp,
      });
      const hot = Math.random();
      fireCol[i * 3] = 1;
      fireCol[i * 3 + 1] = 0.3 + hot * 0.45;
      fireCol[i * 3 + 2] = 0.04 + hot * 0.12;
    }
    const fireGeo = new THREE.BufferGeometry();
    fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
    fireGeo.setAttribute('color', new THREE.BufferAttribute(fireCol, 3));
    const fireMat = new THREE.PointsMaterial({
      size: 4.0, map: sprite, vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: true,
    });
    const fire = new THREE.Points(fireGeo, fireMat);
    fire.position.copy(pos);
    scene.add(fire);

    // Smoke: slow grey points that rise, spread and linger after the fire.
    const smokeCount = 36;
    const smokePos = new Float32Array(smokeCount * 3);
    const smokeVel = [];
    for (let i = 0; i < smokeCount; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      smokeVel.push({ x: Math.cos(a) * sp, y: 6 + Math.random() * 9, z: Math.sin(a) * sp });
    }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokeMat = new THREE.PointsMaterial({
      size: 7, map: sprite, color: 0x555550, transparent: true, opacity: 0.75,
      depthWrite: false, sizeAttenuation: true,
    });
    const smoke = new THREE.Points(smokeGeo, smokeMat);
    smoke.position.copy(pos);
    scene.add(smoke);

    // Shockwave: a blast sphere that swells fast and fades.
    const wave = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    wave.position.copy(pos);
    scene.add(wave);

    // Flash: a hard light that spikes and dies in a blink.
    const light = new THREE.PointLight(0xffb050, 0, 160, 1.6);
    light.position.copy(pos);
    scene.add(light);

    explosions.push({ fire, fireVel, fireMat, smoke, smokeVel, smokeMat, wave, light, age: 0 });
  }

  function fire(flightState) {
    if (simTime - lastFired < WEAPON.cooldown) return false;
    if (!flightState || flightState.status === 'crashed' || flightState.status === 'complete') return false;
    const tracer = tracers.find((t) => !t.alive);
    if (!tracer) return false;
    lastFired = simTime;
    const cp = Math.cos(flightState.pitch);
    const fx = cp * Math.sin(flightState.heading);
    const fy = Math.sin(flightState.pitch);
    const fz = cp * Math.cos(flightState.heading);
    tracer.mesh.position.set(
      flightState.pos.x + fx * 6,
      flightState.pos.y + fy * 6 - 0.4,
      flightState.pos.z + fz * 6,
    );
    tracer.mesh.lookAt(
      tracer.mesh.position.x + fx,
      tracer.mesh.position.y + fy,
      tracer.mesh.position.z + fz,
    );
    tracer.vx = fx * WEAPON.speed + fx * flightState.speed;
    tracer.vy = fy * WEAPON.speed + fy * flightState.speed;
    tracer.vz = fz * WEAPON.speed + fz * flightState.speed;
    tracer.life = WEAPON.life;
    tracer.alive = true;
    tracer.mesh.visible = true;
    return true;
  }

  function update(dt, flightState) {
    simTime += dt;
    let hitCount = 0;
    // Balloons bob gently on their stations.
    for (const t of targets) {
      if (!t.alive) continue;
      t.y = t.baseY + Math.sin(simTime * 0.8 + t.phase) * 1.6;
      t.group.position.y = t.y;
    }
    for (const tr of tracers) {
      if (!tr.alive) continue;
      tr.life -= dt;
      tr.mesh.position.x += tr.vx * dt;
      tr.mesh.position.y += tr.vy * dt;
      tr.mesh.position.z += tr.vz * dt;
      let dead = tr.life <= 0 || tr.mesh.position.y < 1;
      if (!dead) {
        for (const t of targets) {
          if (!t.alive) continue;
          const dx = tr.mesh.position.x - t.group.position.x;
          const dy = tr.mesh.position.y - t.group.position.y;
          const dz = tr.mesh.position.z - t.group.position.z;
          if (dx * dx + dy * dy + dz * dz < (TARGET_RADIUS + 1.5) * (TARGET_RADIUS + 1.5)) {
            t.alive = false;
            t.group.visible = false;
            explode(t.group.position.clone());
            hits += 1;
            hitCount += 1;
            if (onHit) onHit(t);
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        tr.alive = false;
        tr.mesh.visible = false;
      }
    }
    for (let i = explosions.length - 1; i >= 0; i -= 1) {
      const e = explosions[i];
      e.age += dt;
      const fp = e.fire.geometry.attributes.position;
      for (let j = 0; j < e.fireVel.length; j += 1) {
        const v = e.fireVel[j];
        fp.array[j * 3] += v.x * dt;
        fp.array[j * 3 + 1] += v.y * dt;
        fp.array[j * 3 + 2] += v.z * dt;
        v.y -= 12 * dt;
        v.x *= 1 - 1.6 * dt;
        v.z *= 1 - 1.6 * dt;
      }
      fp.needsUpdate = true;
      e.fireMat.opacity = Math.max(0, 1 - e.age / 0.85);
      const sp = e.smoke.geometry.attributes.position;
      for (let j = 0; j < e.smokeVel.length; j += 1) {
        const v = e.smokeVel[j];
        sp.array[j * 3] += v.x * dt;
        sp.array[j * 3 + 1] += v.y * dt;
        sp.array[j * 3 + 2] += v.z * dt;
        v.x *= 1 - 0.4 * dt;
        v.z *= 1 - 0.4 * dt;
      }
      sp.needsUpdate = true;
      e.smokeMat.opacity = Math.max(0, 0.75 * (1 - e.age / 2.2));
      const waveScale = 1 + e.age * 55;
      e.wave.scale.setScalar(Math.min(waveScale, 20));
      e.wave.material.opacity = Math.max(0, 0.4 * (1 - e.age / 0.55));
      e.light.intensity = e.age < 0.12 ? 90 : Math.max(0, 90 * (1 - (e.age - 0.12) / 0.5));
      if (e.age > 2.2) {
        scene.remove(e.fire);
        e.fire.geometry.dispose();
        e.fireMat.dispose();
        scene.remove(e.smoke);
        e.smoke.geometry.dispose();
        e.smokeMat.dispose();
        scene.remove(e.wave);
        e.wave.material.dispose();
        scene.remove(e.light);
        explosions.splice(i, 1);
      }
    }
    return hitCount;
  }

  function reset() {
    for (const t of targets) {
      t.alive = true;
      t.group.visible = true;
      t.y = t.baseY;
      t.group.position.y = t.baseY;
    }
    for (const tr of tracers) {
      tr.alive = false;
      tr.mesh.visible = false;
    }
    for (const e of explosions) {
      scene.remove(e.fire);
      scene.remove(e.smoke);
      scene.remove(e.wave);
      scene.remove(e.light);
    }
    explosions.length = 0;
    hits = 0;
    simTime = 0;
    lastFired = -10;
  }

  return {
    targets,
    fire,
    update,
    reset,
    get hits() { return hits; },
    get total() { return targets.length; },
    set onHit(fn) { onHit = fn; },
  };
}

export { TARGET_SCORE };

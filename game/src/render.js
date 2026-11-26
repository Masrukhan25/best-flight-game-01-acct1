// Island Courier — the three.js view. One consistent flat-shaded tropical
// style: a vertex-coloured island heightfield, a glittering blue sea with
// foam at the shorelines, a gradient sky dome with a sun disc, and a mail
// plane built from primitives — tapered fuselage, livery stripes, glossy
// canopy, spinning propeller with a blur disc, landing gear with hubcaps.
// Lighting is ACES tone-mapped: a hemisphere sky/ground fill plus one warm
// directional sun whose shadow camera follows the plane. The chase camera
// smooths exponentially (1 - exp(-rate * dt), never a fixed lerp), updates
// after the physics step, and takes an FOV kick with speed. Shake is
// trauma-based and added on top of the follow, never inside it.
import * as THREE from 'three';
import { RUNWAY, RING_RADIUS } from './config.js';
import { buildPlane } from './plane.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Deterministic 0..1 hash for terrain colour variation.
function hash2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

// The plane model lives in ./plane.js now (buildPlane): a detailed
// primitive-built courier with a transparent canopy, tapered wings,
// hinged control surfaces and spatted gear.

export function createRenderer(canvas, terrain, rings) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec9e8);
  scene.fog = new THREE.Fog(0xa8d4e8, 900, 3800);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 9000);

  // Sky dome: a gradient shell (deep blue overhead, pale at the horizon)
  // that the fog never touches, plus a bright sun disc in the sun's place.
  const skyGeo = new THREE.SphereGeometry(4200, 24, 14);
  const skyColors = new Float32Array(skyGeo.attributes.position.count * 3);
  const skyTop = new THREE.Color(0x2f7fc4);
  const skyHorizon = new THREE.Color(0xd8eef7);
  const skyTmp = new THREE.Color();
  for (let i = 0; i < skyGeo.attributes.position.count; i += 1) {
    const y = skyGeo.attributes.position.getY(i) / 4200;
    skyTmp.copy(skyHorizon).lerp(skyTop, Math.max(0, Math.min(1, y * 1.4 + 0.12)));
    skyColors[i * 3] = skyTmp.r;
    skyColors[i * 3 + 1] = skyTmp.g;
    skyColors[i * 3 + 2] = skyTmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(150, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
  );
  sunDisc.position.set(1900, 2600, 1150);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x3d5a3a, 1.15));
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 2200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Sea: one flat plane at y = 0, low roughness so the sun glints on it.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 7000),
    new THREE.MeshStandardMaterial({ color: 0x1a6fa8, roughness: 0.28, metalness: 0.25 }),
  );
  sea.geometry.rotateX(-Math.PI / 2);
  sea.receiveShadow = true;
  scene.add(sea);

  // Foam rings where the sea meets each island's shore.
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 });
  for (const isl of terrain.islands) {
    const foam = new THREE.Mesh(new THREE.RingGeometry(isl.r * 0.96, isl.r * 1.07, 56), foamMat);
    foam.geometry.rotateX(-Math.PI / 2);
    foam.position.set(isl.x, 0.4, isl.z);
    scene.add(foam);
  }

  // Islands: displaced heightfield, vertex colours by height with a
  // deterministic jitter so the grass is never one flat green, flat shaded.
  const geo = new THREE.PlaneGeometry(3200, 3200, 110, 110);
  geo.rotateX(-Math.PI / 2);
  const positions = geo.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const sand = new THREE.Color(0xdcc47e);
  const sandWet = new THREE.Color(0xc9ab62);
  const grass = new THREE.Color(0x55a04a);
  const grassDark = new THREE.Color(0x3f8a3c);
  const grassDry = new THREE.Color(0x7fae4e);
  const rock = new THREE.Color(0x8a7f72);
  const rockDark = new THREE.Color(0x59524a);
  const tmp = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = terrain.heightAt(x, z);
    positions.setY(i, h);
    if (h < 1.5) tmp.copy(sandWet);
    else if (h < 3) tmp.copy(sand);
    else if (h < 6) tmp.copy(sand).lerp(grass, (h - 3) / 3);
    else if (h < 28) tmp.copy(grass).lerp(grassDry, Math.min(1, (h - 6) / 22) * 0.35);
    else if (h < 45) tmp.copy(grass).lerp(grassDark, Math.min(1, (h - 28) / 17) * 0.7);
    else if (h < 85) tmp.copy(rock);
    else tmp.copy(rockDark);
    // Deterministic speckle so the fields read as terrain, not paint.
    const j = 0.92 + hash2(x, z) * 0.16;
    colors[i * 3] = Math.min(1, tmp.r * j);
    colors[i * 3 + 1] = Math.min(1, tmp.g * j);
    colors[i * 3 + 2] = Math.min(1, tmp.b * j);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Runway: asphalt slab, white centreline, threshold bars, edge lines.
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x333a40, roughness: 0.9, metalness: 0 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.length, 1.0, RUNWAY.width), asphalt);
  slab.position.set(0, RUNWAY.elevation + 0.1, 0);
  slab.receiveShadow = true;
  scene.add(slab);
  const paint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let x = -200; x <= 200; x += 40) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 1.4), paint);
    dash.position.set(x, RUNWAY.elevation + 0.65, 0);
    scene.add(dash);
  }
  for (const end of [-1, 1]) {
    for (const z of [-9, -3, 3, 9]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 6), paint);
      bar.position.set(end * 208, RUNWAY.elevation + 0.65, z);
      scene.add(bar);
    }
  }
  for (const z of [-12.5, 12.5]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.length, 0.1, 1), paint);
    edge.position.set(0, RUNWAY.elevation + 0.65, z);
    scene.add(edge);
  }

  // PAPI lights beside the threshold: red when low, white when high.
  const papi = [];
  for (let i = 0; i < 4; i += 1) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lamp.position.set(-192 + i * 4, RUNWAY.elevation + 1.4, -22);
    scene.add(lamp);
    papi.push(lamp);
  }

  // Palms: two instanced meshes, trunk + cone crown.
  const dummy = new THREE.Object3D();
  const spots = terrain.treeSpots;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.5, 0.7, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9, flatShading: true }),
    Math.max(1, spots.length),
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.6, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2f8a3a, roughness: 0.85, flatShading: true }),
    Math.max(1, spots.length),
  );
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y + 1.5, s.z);
    dummy.scale.setScalar(s.scale);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(s.x, s.y + 3 + 4, s.z);
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunks);
  scene.add(crowns);

  // Clouds: flat white puffs drifting slowly.
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  for (const c of terrain.cloudSpots) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
    puff.scale.set(c.scale, c.scale * 0.32, c.scale * 0.6);
    puff.position.set(c.x, c.y, c.z);
    scene.add(puff);
    clouds.push(puff);
  }

  // Rings: orange hoops facing the incoming plane.
  const ringMeshes = rings.list.map((ring) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, 1.5, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xcc4400, emissiveIntensity: 0.7, roughness: 0.4 }),
    );
    mesh.position.set(ring.x, ring.y, ring.z);
    mesh.quaternion.setFromUnitVectors(V3(0, 0, 1), V3(ring.axis.x, ring.axis.y, ring.axis.z));
    scene.add(mesh);
    return mesh;
  });

  const { group: plane, prop, blurDisc, controls } = buildPlane(THREE);
  scene.add(plane);

  const camPos = V3(-205, 22.5, 0);
  const lookTarget = V3();
  let trauma = 0;
  let shakeTime = 0;
  let simTime = 0;
  let lastNext = -1;
  let lastFov = 60;

  function addTrauma(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  // Hard-cut the chase camera to the plane: screenshots paint only twice, so
  // the exponential follow would still be catching up in the frame.
  function snapToPlane(flight) {
    const s = flight.state;
    const cp = Math.cos(s.pitch);
    const fx = cp * Math.sin(s.heading);
    const fy = Math.sin(s.pitch);
    const fz = cp * Math.cos(s.heading);
    camPos.set(s.pos.x - fx * 15, s.pos.y - fy * 15 + 4.2, s.pos.z - fz * 15);
  }

  function draw(flight, dt) {
    const s = flight.state;
    simTime += dt;
    plane.position.set(s.pos.x, s.pos.y, s.pos.z);
    plane.rotation.order = 'YXZ';
    plane.rotation.set(-s.pitch, s.heading, -s.bank);
    prop.rotation.z += dt * (4 + s.throttle * 42);
    blurDisc.material.opacity = 0.05 + s.throttle * 0.1;
    // Hinged control surfaces deflect a touch with the bank and pitch, so
    // the plane reads as flying, not posed.
    if (controls.aileronL) controls.aileronL.rotation.x = -s.bank * 0.35;
    if (controls.aileronR) controls.aileronR.rotation.x = s.bank * 0.35;
    if (controls.elevator) controls.elevator.rotation.x = -s.pitch * 0.3;
    if (controls.rudder) controls.rudder.rotation.y = -s.bank * 0.25;

    // The sun and its shadow camera travel with the plane, so the shadows
    // stay crisp wherever the mission goes.
    sun.position.set(s.pos.x + 420, s.pos.y + 620, s.pos.z + 260);
    sun.target.position.set(s.pos.x, s.pos.y, s.pos.z);
    sun.target.updateMatrixWorld();

    // Chase camera: desired spot behind and above the plane, smoothed
    // exponentially, then shake added on top of the follow.
    const cp = Math.cos(s.pitch);
    const fwd = V3(cp * Math.sin(s.heading), Math.sin(s.pitch), cp * Math.cos(s.heading));
    const desired = V3(s.pos.x - fwd.x * 15, s.pos.y - fwd.y * 15 + 4.2, s.pos.z - fwd.z * 15);
    camPos.lerp(desired, 1 - Math.exp(-7 * dt));
    trauma = Math.max(0, trauma - 1.4 * dt);
    shakeTime += dt * 30;
    const shake = trauma * trauma;
    camera.position.set(
      camPos.x + 0.9 * shake * Math.sin(shakeTime * 1.7),
      camPos.y + 0.6 * shake * Math.sin(shakeTime * 2.3),
      camPos.z + 0.9 * shake * Math.sin(shakeTime * 1.1),
    );
    lookTarget.set(s.pos.x + fwd.x * 28, s.pos.y + fwd.y * 28 + 1.2, s.pos.z + fwd.z * 28);
    camera.lookAt(lookTarget);
    const fov = 60 + (s.speed / 85) * 13;
    if (Math.abs(fov - lastFov) > 0.1) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      lastFov = fov;
    }

    // Rings: next one pulses orange, passed ones turn green.
    if (rings.next !== lastNext) {
      ringMeshes.forEach((mesh, i) => {
        if (i < rings.next) {
          mesh.material.color.setHex(0x2fae4e);
          mesh.material.emissive.setHex(0x0f5a26);
        }
      });
      lastNext = rings.next;
    }
    const nextMesh = ringMeshes[rings.next];
    if (nextMesh) nextMesh.scale.setScalar(1 + 0.05 * Math.sin(simTime * 3.5));

    // PAPI: glide-slope colour while on approach.
    const distThr = Math.hypot(-160 - s.pos.x, s.pos.z);
    const aligned = Math.abs(((s.heading - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.5;
    if (distThr < 700 && aligned && s.pos.y < 130 && !s.onGround) {
      const glideErr = s.pos.y - (RUNWAY.elevation + distThr * 0.055);
      const colour = glideErr < -4 ? 0xff2222 : glideErr > 4 ? 0xffffff : 0xffcc88;
      for (const lamp of papi) lamp.material.color.setHex(colour);
    }

    for (const cloud of clouds) {
      cloud.position.x += dt * 2;
      if (cloud.position.x > 1700) cloud.position.x = -1700;
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  Object.assign(window, { renderer, scene });
  return { draw, addTrauma, snapToPlane, renderer, scene, camera };
}

// Island Courier — the mail plane, built from primitives in much finer
// detail than a tube-and-boxes silhouette: a stepped cowling with cooling
// intake and exhaust stacks, a two-seat cockpit with seats and panel
// visible through a transparent canopy, tapered wings (extruded planform,
// not slabs) with separate ailerons and flaps, a tapered tail with
// separate elevator and rudder, a three-blade propeller, spatted landing
// gear, pitot tube and antenna mast, and livery — cheatline stripes,
// wing roundels and a registration decal drawn on a canvas texture.
// Forward is +Z, so the nose sits at +Z and the prop spins about Z.
//
// buildPlane(THREE) returns { group, prop, blurDisc, controls } where
// controls holds the four hinged surfaces (aileronL, aileronR, elevator,
// rudder) so the renderer can deflect them a touch with bank and pitch.
export function buildPlane(THREE) {
  const group = new THREE.Group();
  const add = (mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // ---- Materials -------------------------------------------------------
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.38, metalness: 0.22, flatShading: true });
  const orangeDark = new THREE.MeshStandardMaterial({ color: 0xd9550d, roughness: 0.45, metalness: 0.2, flatShading: true });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.5, metalness: 0.08, flatShading: true });
  const red = new THREE.MeshStandardMaterial({ color: 0xc22e24, roughness: 0.45, metalness: 0.15, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.35, metalness: 0.5, flatShading: true });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4ab, roughness: 0.25, metalness: 0.85, flatShading: true });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.95, metalness: 0, flatShading: true });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9fd4e8, roughness: 0.05, metalness: 0.1,
    transparent: true, opacity: 0.5, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.9, metalness: 0, flatShading: true });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.6, metalness: 0.3, flatShading: true });

  // ---- Fuselage: stepped, tapering nose-to-tail ------------------------
  // Tail cone (narrow), mid cabin tube, shoulder, then the engine cowling.
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.16, 2.4, 12), orange);
  tailCone.geometry.rotateX(-Math.PI / 2);
  add(tailCone, 0, 0.08, -3.1);
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), red);
  add(tailTip, 0, 0.08, -4.3);
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.52, 3.0, 14), orange);
  cabin.geometry.rotateX(Math.PI / 2);
  add(cabin, 0, 0, -0.4);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.78, 1.1, 14), orange);
  shoulder.geometry.rotateX(Math.PI / 2);
  add(shoulder, 0, 0, 1.65);
  // Belly fairing under the cabin — the courier's cargo bulge.
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), orangeDark);
  belly.scale.set(0.9, 0.55, 2.2);
  add(belly, 0, -0.55, -0.2);
  // Engine cowling: slightly wider ring + rounded nose bowl.
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.88, 1.0, 14), cream);
  cowl.geometry.rotateX(Math.PI / 2);
  add(cowl, 0, 0, 2.7);
  const noseBowl = new THREE.Mesh(new THREE.SphereGeometry(0.92, 14, 10), cream);
  noseBowl.scale.set(1, 1, 0.45);
  add(noseBowl, 0, 0, 3.2);
  // Cooling intake under the cowling + two exhaust stacks on the sides.
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), dark);
  add(intake, 0, -0.82, 2.85);
  for (const side of [-1, 1]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.5, 8), steel);
    stack.rotation.z = side * 0.5;
    add(stack, side * 0.86, 0.25, 2.55);
  }

  // ---- Livery: cheatline stripes + registration decal ------------------
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 4.6), cream);
    add(stripe, side * 0.8, 0.14, -0.4);
    const stripeThin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 4.6), red);
    add(stripeThin, side * 0.82, -0.08, -0.4);
  }
  // Registration "N-IC-01" drawn once on a canvas, decalled on both sides
  // of the flat fin (a flat surface — it would float off the curved
  // fuselage, so it lives on the tail where real planes put it).
  const decalCanvas = document.createElement('canvas');
  decalCanvas.width = 256;
  decalCanvas.height = 64;
  const dctx = decalCanvas.getContext('2d');
  dctx.clearRect(0, 0, 256, 64);
  dctx.fillStyle = '#ffffff';
  dctx.font = 'bold 44px system-ui, sans-serif';
  dctx.textAlign = 'center';
  dctx.textBaseline = 'middle';
  dctx.fillText('N-IC-01', 128, 34);
  const decalTex = new THREE.CanvasTexture(decalCanvas);
  decalTex.colorSpace = THREE.SRGBColorSpace;
  const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), decalMat);
    decal.position.set(side * 0.12, 1.0, -3.45);
    decal.rotation.y = side * Math.PI / 2;
    group.add(decal);
  }

  // ---- Cockpit: seats + panel under a transparent two-seat canopy ------
  for (const z of [0.55, 1.45]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.18), seatMat);
    add(seat, 0, 0.42, z - 0.35);
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), seatMat);
    add(seatBase, 0, 0.12, z - 0.1);
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.12), seatMat);
    add(headrest, 0, 0.82, z - 0.42);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.12), panelMat);
  panel.rotation.x = -0.25;
  add(panel, 0, 0.55, 2.05);
  // Canopy: a long bubble, flattened, with a frame spine and windscreen bow.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 14), glass);
  canopy.scale.set(0.92, 0.62, 2.1);
  add(canopy, 0, 0.72, 1.15);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.9), orangeDark);
  add(spine, 0, 1.16, 1.15);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 16, Math.PI), orangeDark);
  bow.rotation.z = 0;
  bow.rotation.y = Math.PI / 2;
  add(bow, 0, 0.72, 2.35);
  // Antenna mast on the cabin roof, pitot tube under the port wing.
  const mast = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 6), dark);
  add(mast, 0, 1.15, -0.9);
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), steel);
  pitot.geometry.rotateX(Math.PI / 2);
  add(pitot, -2.6, -0.32, 1.9);

  // ---- Wings: tapered extruded planform, dihedral, roundels ------------
  // Planform trapezoid: root chord 2.6, tip chord 1.5, half-span 6.9.
  // `side` signs the span so the port wing is built, not mirrored —
  // a negative scale would flip the face winding.
  function taperedWing(span, rootChord, tipChord, thickness, side = 1) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -rootChord / 2);
    shape.lineTo(side * span, -tipChord / 2);
    shape.lineTo(side * span, tipChord / 2);
    shape.lineTo(0, rootChord / 2);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // shape plane -> XZ, thickness becomes +Y
    geo.translate(0, thickness / 2, 0);
    return geo;
  }
  const wingGeoL = taperedWing(6.9, 2.6, 1.5, 0.22, -1);
  const wingGeoR = taperedWing(6.9, 2.6, 1.5, 0.22, 1);
  const controls = {};
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(side < 0 ? wingGeoL : wingGeoR, cream);
    // Dihedral: tips rise a touch — rotation.z signs with the side.
    wing.rotation.z = side * 0.055;
    wing.position.set(side * 0.55, -0.12, 0.6);
    group.add(wing);
    // Orange tip cap: a short tapered slice at the far end.
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 1.5), orange);
    tip.rotation.z = side * 0.055;
    add(tip, side * 6.9, 0.12, 0.6);
    // Roundel on the upper wing: red ring, white middle, orange centre.
    const roundel = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), new THREE.MeshBasicMaterial({ color: 0xc22e24 }));
    const mid = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mid.position.z = 0.01;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
    dot.position.z = 0.02;
    roundel.add(ring, mid, dot);
    roundel.rotation.x = -Math.PI / 2;
    roundel.rotation.z = side * 0.055;
    // Wing top surface sits at y ≈ 0.21 at the root and rises with the
    // dihedral (≈0.18 higher out at the roundel): ride just above it.
    roundel.position.set(side * 3.9, 0.42, 0.6);
    group.add(roundel);
    // Nav light on the tip: red port, green starboard, emissive.
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshStandardMaterial({
        color: side < 0 ? 0xff2222 : 0x22ff66,
        emissive: side < 0 ? 0xff2222 : 0x22ff66, emissiveIntensity: 1.6,
      }),
    );
    add(nav, side * 7.35, 0.12, 0.6);
    // Landing light set into the port leading edge.
    if (side < 0) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 2 }),
      );
      add(lamp, -2.4, -0.1, 1.85);
    }
    // Aileron: separate hinged surface at the trailing edge, outboard.
    const aileron = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.7), orange);
    aileron.geometry.translate(side * 1.3, 0, 0); // hinge at the inboard edge
    aileron.rotation.z = side * 0.055;
    aileron.position.set(side * 4.0, -0.05, -0.75);
    group.add(aileron);
    controls[side < 0 ? 'aileronL' : 'aileronR'] = aileron;
    // Flap: inboard trailing-edge surface, slightly drooped at rest.
    const flap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.7), orangeDark);
    flap.rotation.z = side * 0.055;
    flap.rotation.x = 0.1;
    add(flap, side * 1.85, -0.06, -0.75);
  }

  // ---- Tail: tapered stabiliser + fin, hinged elevator & rudder --------
  const stabGeoL = taperedWing(2.3, 1.6, 1.0, 0.16, -1);
  const stabGeoR = taperedWing(2.3, 1.6, 1.0, 0.16, 1);
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(side < 0 ? stabGeoL : stabGeoR, cream);
    stab.position.set(side * 0.3, 0.28, -3.7);
    group.add(stab);
    const stabTip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.0), orange);
    add(stabTip, side * 2.45, 0.28, -3.7);
  }
  // Elevator: one hinged surface spanning the stabiliser trailing edge.
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 0.55), orange);
  elevator.position.set(0, 0.28, -4.75);
  group.add(elevator);
  controls.elevator = elevator;
  // Fin: tapered vertical surface, swept back. The extruded shape lies in
  // the XY plane (chord along X), so rotate it onto the ZY plane: chord
  // along -Z (toward the tail), thickness along X, height along Y.
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.7, 0.25);
  finShape.lineTo(1.15, 1.9);
  finShape.lineTo(0.15, 1.9);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.16, bevelEnabled: false });
  finGeo.translate(0, 0, -0.08);
  finGeo.rotateY(Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, orange);
  fin.position.set(0, 0.35, -2.7);
  group.add(fin);
  const finBand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.9), cream);
  add(finBand, 0, 1.55, -3.4);
  // Rudder: separate hinged surface on the fin trailing edge.
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.6), red);
  rudder.geometry.translate(0, 0, -0.3); // hinge at the leading edge
  rudder.position.set(0, 1.15, -3.95);
  group.add(rudder);
  controls.rudder = rudder;
  // White tail position light, emissive.
  const tailLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4 }),
  );
  add(tailLight, 0, 0.08, -4.35);

  // ---- Propeller: three tapered blades + spinner + blur disc -----------
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.95, 12), red);
  spinner.geometry.rotateX(Math.PI / 2);
  spinner.position.z = 0.45;
  prop.add(spinner);
  const spinnerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
  spinnerBase.geometry.rotateX(Math.PI / 2);
  spinnerBase.position.z = 0.05;
  prop.add(spinnerBase);
  for (let i = 0; i < 3; i += 1) {
    const blade = new THREE.Group();
    const bladeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.2, 0.1), dark);
    bladeMesh.position.y = 1.35;
    // Taper the tip: a smaller box at the end, slightly twisted.
    const bladeTip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.08), steel);
    bladeTip.position.y = 2.6;
    bladeTip.rotation.z = 0.12;
    blade.add(bladeMesh, bladeTip);
    blade.rotation.z = (i / 3) * Math.PI * 2;
    blade.rotation.y = 0.25; // pitch the blades a touch
    prop.add(blade);
  }
  const blurDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
  );
  blurDisc.position.z = 0.05;
  prop.add(blurDisc);
  prop.position.z = 4.35;
  group.add(prop);

  // ---- Landing gear: spatted mains + tail wheel -------------------------
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), steel);
    strut.rotation.z = side * 0.15;
    add(strut, side * 1.35, -0.8, 1.3);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.32, 14), tyre);
    wheel.geometry.rotateZ(Math.PI / 2);
    add(wheel, side * 1.45, -1.32, 1.3);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 8), cream);
    hub.geometry.rotateZ(Math.PI / 2);
    add(hub, side * 1.45, -1.32, 1.3);
    // Wheel spat: a teardrop fairing over the top of the wheel.
    const spat = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 8), orange);
    spat.scale.set(0.55, 1, 1.5);
    add(spat, side * 1.45, -1.05, 1.3);
  }
  const tailStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.65, 6), steel);
  add(tailStrut, 0, -0.7, -3.5);
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 8), tyre);
  tailWheel.geometry.rotateZ(Math.PI / 2);
  add(tailWheel, 0, -1.0, -3.5);

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group, prop, blurDisc, controls };
}

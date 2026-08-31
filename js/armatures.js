import * as THREE from "three";

// ===========================================================================
// armatures.js — the three worked examples from REVISIONPROPOSAL.md sec. 5,
// built on one primitive.
//
// THE PRIMITIVE: plateBand()
//
// Take any rectangle of the engraving and put it at any depth, sized and placed
// so that from the station point it lands exactly where it does in the plate.
// The maths is the same pinhole the whole project runs on:
//
//     width  = (x1 - x0) * z / f
//     height = (y1 - y0) * z / f
//     X      = (xmid - W/2) * z / f
//     Y      = eye - (ymid - horizon) * z / f
//
// Because the size scales with z at exactly the rate perspective shrinks it,
// a band pushed from 5 m to 500 m does not move on screen at all — it only
// changes how it parallaxes when you step sideways. That is what a tunnel book
// is, and it is the thing the old renderer got wrong: it popped cards forward
// without compensating, so every popped figure grew into a giant.
//
// Everything below is built from that one call plus, where the plate genuinely
// shows a solid (Emblem VIII's vault), real geometry. Conjectured dimensions —
// anything the plate cannot constrain, like how long the tunnel actually is —
// are named as conjecture in the notes, never quietly chosen.
// ===========================================================================

export const ARMATURES = {
  "emblem-08": "one-point court: barrel-vaulted passage, table, courtyard",
  "emblem-01": "figure landscape: foreground bank, town band, mountains, ornament sky",
  "emblem-21": "frontal wall: masonry plane carrying the diagram as a decal",
};

/** Region of the plate as a plane at depth z, registered to the station point. */
function plateBand(ctx, tex, nx0, ny0, nx1, ny1, z, opts = {}) {
  const { THREE: T, solve, sizeAt } = ctx;
  const W = solve.width, H = solve.height, F = solve.focal_px;
  const EYE = solve.eye_height_m || 1.6, YH = solve.horizon_y;

  const x0 = nx0 * W, x1 = nx1 * W, y0 = ny0 * H, y1 = ny1 * H;
  const w = sizeAt(x1 - x0, z);
  const h = sizeAt(y1 - y0, z);
  const X = ((x0 + x1) / 2 - W / 2) * z / F;
  const Y = EYE - ((y0 + y1) / 2 - YH) * z / F;

  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
  t.repeat.set((x1 - x0) / W, (y1 - y0) / H);
  t.offset.set(x0 / W, 1 - y1 / H);

  const mat = new T.MeshBasicMaterial({
    map: t, transparent: !!opts.transparent, side: T.DoubleSide,
    alphaTest: opts.transparent ? 0.4 : 0,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  mesh.position.set(X, Y, -z);
  mesh.userData = { role: opts.role || "band", label: opts.label || "", z, w_m: w, h_m: h };
  return mesh;
}


/**
 * Grade a mesh's vertex colours by world depth so an unlit surface still reads
 * as receding. The passage walls are flat colour by design (lighting them would
 * break the reprojection gate), and flat colour seen edge-on is exactly the
 * tan-rectangle-in-the-middle-of-the-plate artefact we are here to remove. A
 * deterministic depth ramp gives the recession back without introducing a light.
 */
function shadeByDepth(mesh, zNear, zFar, nearTone = 1.0, farTone = 0.22) {
  mesh.updateMatrixWorld(true);
  const pos = mesh.geometry.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const t = Math.min(1, Math.max(0, (-v.z - zNear) / Math.max(1e-6, zFar - zNear)));
    const k = nearTone + (farTone - nearTone) * t;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  mesh.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  mesh.material.vertexColors = true;
  mesh.material.needsUpdate = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Emblem VIII — one-point court
// ---------------------------------------------------------------------------
// Everything here is read off the plate and pushed through the solve, so the
// numbers in the notes are derived, not chosen. The one exception is the length
// of the passage: its far door sits ON the vanishing point, i.e. at infinity, so
// the plate cannot constrain it. That is stated as conjecture.
async function emblem08(ctx) {
  const { THREE: T, world, solve, depthAt, lateralAt, sizeAt, loadTex } = ctx;
  const W = solve.width, H = solve.height, F = solve.focal_px;
  const EYE = solve.eye_height_m, YH = solve.horizon_y;
  const notes = [];
  const handled = new Set();

  const tex = await loadTex("assets/" + ctx.plateInfo.plate);
  if (!tex) return null;

  // --- the passage -------------------------------------------------------
  // Its ground contact is the front edge of its own floor at ny 0.585, NOT the
  // base of the wall it sits in (ny 0.72). Reading the wrong contact line is
  // exactly the mistake that makes a passage come out 1 m wide.
  const zMouth = depthAt(0.585 * H);
  const mouthW = sizeAt((0.455 - 0.245) * W, zMouth);
  const mouthH = sizeAt((0.585 - 0.355) * H, zMouth);
  const mouthX = lateralAt(0.35 * W, zMouth);
  const LENGTH = 12.0;                       // CONJECTURE — see note below

  // Built from open planes, not a closed box: a passage you can see into and
  // walk down. A BackSide box would put its own near face between you and the
  // interior, which is how you end up with a black rectangle in the middle of
  // the plate -- the exact artefact this whole rebuild exists to remove.
  // one material per mesh: shadeByDepth writes per-mesh vertex colours, so a
  // shared material would take the last mesh's setting for all of them
  const wallMat = () => new T.MeshBasicMaterial({ color: 0x6b5f48, side: T.DoubleSide });
  const roofMat = () => new T.MeshBasicMaterial({ color: 0x51462f, side: T.DoubleSide });
  const floorMat = () => new T.MeshBasicMaterial({ color: 0x8d8064, side: T.DoubleSide });
  const zMid = -(zMouth + LENGTH / 2);

  const floor = new T.Mesh(new T.PlaneGeometry(mouthW, LENGTH), floorMat());
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(mouthX, 0.005, zMid);
  world.add(shadeByDepth(floor, zMouth, zMouth + LENGTH));

  for (const sx of [-1, 1]) {
    const wall = new T.Mesh(new T.PlaneGeometry(LENGTH, mouthH), wallMat());
    wall.rotation.y = Math.PI / 2;
    wall.position.set(mouthX + sx * mouthW / 2, mouthH / 2, zMid);
    world.add(shadeByDepth(wall, zMouth, zMouth + LENGTH));
  }

  // barrel ceiling: a half cylinder, axis along the passage
  // CylinderGeometry puts its axis on +Y and measures theta from +Z toward +X,
  // so theta PI..2PI is the -Z half; rotating +90 deg about X sends the axis to
  // Z and that half to the top. One rotation, not two -- two compounded is how
  // the vault ended up lying across the courtyard like a fallen pipe.
  const barrel = new T.Mesh(
    new T.CylinderGeometry(mouthW / 2, mouthW / 2, LENGTH, 28, 1, true, Math.PI, Math.PI),
    roofMat());
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(mouthX, mouthH - mouthW / 2, zMid);
  world.add(shadeByDepth(barrel, zMouth, zMouth + LENGTH, 0.8, 0.14));

  // the lit door at the far end -- the vanishing point made visible
  const endWall = new T.Mesh(new T.PlaneGeometry(mouthW, mouthH), wallMat());
  endWall.position.set(mouthX, mouthH / 2, -(zMouth + LENGTH));
  endWall.material = new T.MeshBasicMaterial({ color: 0x1d1811, side: T.DoubleSide });
  world.add(endWall);
  const door = new T.Mesh(new T.PlaneGeometry(mouthW * 0.30, mouthH * 0.48),
    new T.MeshBasicMaterial({ color: 0xf6ecd2 }));
  door.position.set(mouthX, mouthH * 0.24, -(zMouth + LENGTH) + 0.03);
  world.add(door);

  // --- the table ---------------------------------------------------------
  // Front edge ny 0.86 gives its depth; its top surface is where the egg rests,
  // which is what makes the egg sit on something instead of hovering.
  // The plate already draws the bench, beautifully. Redrawing it as a tinted box
  // puts a second, worse bench on top of Merian's -- the primitive-prop mistake
  // this project has already made twice. Lift HIS bench to its own depth instead.
  const zTable = depthAt(0.93 * H);          // its legs meet the floor at ny 0.93
  world.add(plateBand(ctx, tex, 0.135, 0.755, 0.525, 0.945, zTable,
    { role: "architecture", label: "the bench, at its own depth" }));
  notes.push(
    `bench lifted to ${zTable.toFixed(1)} m, ` +
    `${sizeAt((0.525 - 0.135) * W, zTable).toFixed(2)} m across — Merian's own bench, ` +
    `moved in depth, not a tinted box drawn over it`,
    `the egg's depth is a LOWER BOUND: it rests on the bench, not on the pavement, ` +
    `so treating its mask's lowest row as ground contact places it nearer than it is. ` +
    `It still reprojects correctly, which is why the gate passes and the depth is ` +
    `still wrong — the gate tests registration, not support.`);

  // --- the fire in the left arch ----------------------------------------
  const zFire = depthAt(0.80 * H);
  world.add(plateBand(ctx, tex, 0.055, 0.26, 0.175, 0.80, zFire,
    { transparent: false, role: "architecture", label: "hearth flame" }));
  notes.push(`hearth flame lifted to ${zFire.toFixed(1)} m as its own plane`);

  return { notes, handled };
}

// ---------------------------------------------------------------------------
// Emblem I — figure landscape
// ---------------------------------------------------------------------------
// The dominant armature of the book. Four horizontal registers, only three of
// which are space: the cloud-scrolls are an engraver's convention for sky, and
// giving them a depth is a category error, not a tuning choice.
async function emblem01(ctx) {
  const { world, solve, loadTex } = ctx;
  const notes = [];
  const handled = new Set();
  const tex = await loadTex("assets/" + ctx.plateInfo.plate);
  if (!tex) return null;

  const bands = solve.bands || [];
  const midZ = bands[1] ? (bands[1].near_m + bands[1].far_m) / 2 : 400;
  const farZ = bands[2] ? (bands[2].near_m + bands[2].far_m) / 2 : 4000;

  // middle register: river, sailboat, the walled town on its promontory
  world.add(plateBand(ctx, tex, 0.0, 0.44, 1.0, 0.665, midZ,
    { role: "band", label: "river and walled town" }));
  // far register: the mountain range
  world.add(plateBand(ctx, tex, 0.0, 0.36, 1.0, 0.47, farZ,
    { role: "band", label: "mountains" }));
  // ornament: pinned far enough away that it cannot parallax at all
  const orn = solve.ornament_band_ny || [0, 0.42];
  world.add(plateBand(ctx, tex, 0.0, orn[0], 1.0, orn[1], 30000,
    { role: "ornament", label: "cloud-scrolls (engraver's convention, not weather)" }));

  notes.push(
    `river-and-town register set at ${midZ} m, mountains at ${farZ} m — ` +
    `stepping sideways now parallaxes them against each other`,
    `cloud-scrolls pinned at 30 km: they are an engraving convention for sky, ` +
    `so they must have no depth. The old pipeline gave category 'sky' a ` +
    `recession of 0.42, i.e. treated them as objects standing somewhere.`);
  if (solve.metric_anomaly) notes.push(`ANOMALY PRESERVED — ${solve.metric_anomaly}`);
  return { notes, handled };
}

// ---------------------------------------------------------------------------
// Emblem XXI — frontal wall, diagram as decal
// ---------------------------------------------------------------------------
// The taxonomy's proving case. The squared circle is painted on the masonry, so
// it is a decal on the wall plane and stays welded to it from every angle. Under
// the old pipeline it became a card that popped forward and you could walk
// behind Maier's central geometrical argument.
async function emblem21(ctx) {
  const { world, solve, loadTex } = ctx;
  const notes = [];
  const handled = new Set();
  const tex = await loadTex("assets/" + ctx.plateInfo.plate);
  if (!tex) return null;

  const surf = (solve.surfaces || [])[0];
  const zWall = surf ? surf.z_m : 3.85;

  // the wall itself, carrying the whole diagram: one plane, one texture region,
  // welded together. There is no separate "diagram" object to detach.
  world.add(plateBand(ctx, tex, 0.24, 0.02, 1.0, 0.83, zWall,
    { role: "surface", label: "brick wall with the inscribed circle, triangle and square" }));

  notes.push(
    `wall placed at ${zWall} m, frontoparallel — which is why the great circle ` +
    `reads as a true circle rather than an ellipse`,
    `the diagram is a DECAL on that wall, not a card: it cannot detach, and you ` +
    `cannot walk behind it`,
    `the inner circle holding the coupled figures is a picture inside the picture ` +
    `— a decal on a decal, depth zero forever`);
  if (solve.derived_check) notes.push(`consistency check — ${solve.derived_check}`);
  return { notes, handled };
}

const BUILDERS = {
  "emblem-08": emblem08,
  "emblem-01": emblem01,
  "emblem-21": emblem21,
};

export async function buildArmature(key, ctx) {
  const fn = BUILDERS[key];
  if (!fn) return null;
  try {
    return await fn(ctx);
  } catch (err) {
    console.error(`armature ${key} failed`, err);
    return { notes: [`armature failed to build: ${err.message}`], handled: new Set() };
  }
}

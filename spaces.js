import * as THREE from "three";
import { makeStoneFacadeTexture, makeCobbleTexture, makeGrassTexture, makeSoilTexture, makeWoodFloorTexture, makeSandTexture } from "./textures.js?v=2";

// ===========================================================================
// spaces.js — perspective ARMATURES: the actual three-dimensional space each
// Atalanta engraving constructs with its lines, planes and angles, rebuilt so
// the viewer stands INSIDE the depicted place rather than in front of a
// framed print of it. This is the Emblem VIII flagship idea (courtyard +
// tunnel + walls) generalized into a handful of reusable perspective types,
// each read off the plates themselves:
//
//   interiorBox      — a one-point-perspective room: floor + back wall + two
//                      side walls, one wall carrying a hearth, another a
//                      daylight window; viewer in the doorway. (Emblem XXII's
//                      kitchen, XXVIII/XLVIII's bath-chambers, the workshops
//                      and laboratories.)
//   walledCourt      — paved ground receding to a tall back wall pierced by a
//                      central arch, side walls framing the action. (VIII, and
//                      the courtyards/castles/temples.)
//   figureLandscape  — the dominant type: a near ground plane where the main
//                      figure stands, a middle band of river + walled town on
//                      its promontory (with a sailboat), a far mountain range,
//                      and a high band of Merian's rolled cloud-scrolls.
//                      (Emblem I's Boreas, and the farms/gardens/hills/shores.)
//   diagramWall      — a walled yard whose back wall carries a large inscribed
//                      geometric construction (circle/triangle/square with the
//                      coniunctio pair inside). (Emblem XXI.)
//
// Each armature builds its geometry into `world` and returns a descriptor:
//   { spawn:{pos,look}, bounds:{minX,maxX,minZ,maxZ}, anchors:{...}, plate:{...} }
// so scene.js can drop the camera in the doorway, clamp walking to the room,
// stage the emblem's own symbolic props at the right places within the space,
// and mount the source engraving as a toggleable reference on the far wall.
// ===========================================================================

const FLOOR = { cobble: makeCobbleTexture, grass: makeGrassTexture, soil: makeSoilTexture, wood: makeWoodFloorTexture, sand: makeSandTexture };
function floorMat(ctx, key) { const map = (FLOOR[key] || makeCobbleTexture)(); return ctx.toon({ color: 0xffffff, map }); }
function stoneMat(ctx, hex) { return ctx.toon({ color: 0xffffff, map: makeStoneFacadeTexture("#" + hex.toString(16).padStart(6, "0")) }); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Interior box — an enclosed room in one-point perspective
// ---------------------------------------------------------------------------
export function interiorBox(env, p = {}) {
  const { ctx, world, anim } = env;
  const W = p.w ?? 15, D = p.d ?? 15, H = p.h ?? 7;
  const wallHex = p.wall ?? 0x8c7c5c;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat(ctx, p.floor || "wood"));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.4), stoneMat(ctx, wallHex));
  back.position.set(0, H / 2, -D / 2); back.receiveShadow = true; world.add(back);
  for (const sx of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(D, H, 0.4), stoneMat(ctx, wallHex));
    sw.position.set(sx * W / 2, H / 2, 0); sw.rotation.y = Math.PI / 2; sw.receiveShadow = true; world.add(sw);
  }
  // ceiling beams — imply the roof without darkening the room
  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.3), ctx.toon({ color: 0x4a3420 }));
    beam.position.set(0, H - 0.2, -D / 2 + 2 + i * (D / 3.2)); world.add(beam);
  }

  // hearth platform on the left wall (the kitchen fire, the bath's furnace)
  if (p.hearth) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, D * 0.55), stoneMat(ctx, 0x6f5a40));
    ledge.position.set(-W / 2 + 1.4, 0.5, -D * 0.12); ledge.castShadow = ledge.receiveShadow = true; world.add(ledge);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.5, D * 0.55 + 0.4), ctx.toon({ color: 0x2f2416 }));
    hood.position.set(-W / 2 + 1.4, H - 0.85, -D * 0.12); world.add(hood);
  }

  // daylight window on the right wall — the scene's real light source
  if (p.window) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), new THREE.MeshBasicMaterial({ color: 0xd8e0e6 }));
    win.position.set(W / 2 - 0.25, 3.6, D * 0.08); win.rotation.y = -Math.PI / 2; world.add(win);
    // leaded mullions
    for (const mx of [-0.6, 0, 0.6]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.06), ctx.toon({ color: 0x3a2e1e })); bar.position.set(W / 2 - 0.22, 3.6, D * 0.08 + mx); world.add(bar); }
    for (const my of [-0.7, 0, 0.7]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.6), ctx.toon({ color: 0x3a2e1e })); bar.position.set(W / 2 - 0.22, 3.6 + my, D * 0.08); world.add(bar); }
    const winLight = new THREE.PointLight(0xfff2d6, 1.8, 24, 2); winLight.position.set(W / 2 - 2.5, 3.4, D * 0.08); winLight.userData.base = winLight.intensity; world.add(winLight); anim.lums.push(winLight);
  }

  // plate-shelves on the back wall (dishes, pots — the kitchen/library reading)
  if (p.shelves) {
    for (let r = 0; r < 2; r++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.12, 0.5), ctx.toon({ color: 0x5c4228 }));
      sh.position.set(W * 0.12, 3.0 + r * 1.3, -D / 2 + 0.4); world.add(sh);
      for (let j = 0; j < 4; j++) { const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), ctx.toon({ color: 0xcbb98a })); plate.rotation.x = Math.PI / 2; plate.position.set(W * 0.12 - W * 0.22 + j * (W * 0.15), 3.3 + r * 1.3, -D / 2 + 0.45); world.add(plate); }
    }
  }

  // when there's a hearth, the central alchemical action (fire, egg, vessel,
  // cauldron) sits ON its ledge top — not floating at floor level clipping
  // through the masonry — directly over the ledge's own footprint
  const central = p.hearth ? V(-W / 2 + 1.4, 1.0, -D * 0.12) : V(0, 0, -D * 0.1);
  return {
    spawn: { pos: V(0, 1.7, D / 2 - 2.5), look: V(0, 1.6, -D / 2 + 1) },
    bounds: { minX: -W / 2 + 1.1, maxX: W / 2 - 1.1, minZ: -D / 2 + 1.1, maxZ: D / 2 - 1.1 },
    anchors: { central, actors: V(1.4, 0, -0.5), creature: V(3, 0, 1.4), scenery: V(-W / 2 + 2, 0, D * 0.2), sky: V(0, H - 1.2, -D * 0.25) },
    plate: { pos: [0, 3.6, -D / 2 + 0.25], w: 5.0, h: 4.1, rotY: 0 },
  };
}

// ---------------------------------------------------------------------------
// Walled court — paved ground, tall back wall with a central arch, side walls
// ---------------------------------------------------------------------------
export function walledCourt(env, p = {}) {
  const { ctx, world, anim } = env;
  const W = p.w ?? 18, D = p.d ?? 20, H = p.h ?? 8, backZ = -D / 2;
  const brick = 0x8a7559;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, D + 6), floorMat(ctx, p.floor || "cobble"));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);

  if (p.arch !== false) {
    const archW = 4.2, side = (W - archW) / 2;
    for (const sx of [-1, 1]) { const bw = new THREE.Mesh(new THREE.BoxGeometry(side, H, 0.6), stoneMat(ctx, brick)); bw.position.set(sx * (archW / 2 + side / 2), H / 2, backZ); bw.receiveShadow = true; world.add(bw); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(archW + 0.4, H - 4.6, 0.6), stoneMat(ctx, brick)); lintel.position.set(0, 4.6 + (H - 4.6) / 2, backZ); world.add(lintel);
    // a receding vaulted passage to a glowing far doorway
    for (let i = 0; i < 5; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(archW, 4.6, 0.3), ctx.toon({ color: 0x2a1e12, side: THREE.DoubleSide })); seg.position.set(0, 2.3, backZ - 0.6 - i * 1.2); world.add(seg); }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(archW, 4.6), new THREE.MeshBasicMaterial({ color: 0xd9c48a })); glow.position.set(0, 2.3, backZ - 7); world.add(glow);
    const gLight = new THREE.PointLight(0xd9c48a, 1.4, 16, 2); gLight.position.set(0, 2.3, backZ - 5); gLight.userData.base = gLight.intensity; world.add(gLight); anim.lums.push(gLight);
  } else {
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.6), stoneMat(ctx, brick)); back.position.set(0, H / 2, backZ); back.receiveShadow = true; world.add(back);
  }

  for (const sx of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(D, H, 0.6), stoneMat(ctx, brick)); sw.position.set(sx * W / 2, H / 2, 0); sw.rotation.y = Math.PI / 2; sw.receiveShadow = true; world.add(sw); }

  // crenellations along the wall tops
  const merlon = (x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), stoneMat(ctx, brick)); m.position.set(x, H + 0.35, z); world.add(m); };
  for (let x = -W / 2; x <= W / 2; x += 1.5) merlon(x, backZ);
  for (let z = -D / 2; z <= D / 2; z += 1.5) { merlon(-W / 2, z); merlon(W / 2, z); }

  return {
    spawn: { pos: V(0, 1.7, D / 2 - 2.5), look: V(0, 1.7, backZ) },
    bounds: { minX: -W / 2 + 1.1, maxX: W / 2 - 1.1, minZ: -D / 2 + 1.1, maxZ: D / 2 - 1.1 },
    anchors: { central: V(0, 0, -2), actors: V(1.6, 0, 1.5), creature: V(-3, 0, -0.5), scenery: V(-W / 2 + 2.5, 0, backZ + 3), sky: V(0, H, backZ + 2) },
    plate: { pos: [W / 2 - 0.35, 3.4, 2], w: 4.4, h: 3.6, rotY: -Math.PI / 2 },
  };
}

// ---------------------------------------------------------------------------
// Figure landscape — near ground, mid river-town band, far mountains, clouds
// ---------------------------------------------------------------------------
export function figureLandscape(env, p = {}) {
  const { ctx, world, anim } = env;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat(ctx, p.floor || "grass"));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);

  const townZ = -16;
  // walled town on its spit of land — boxes of varying height + a round tower + a ruined arch
  for (let i = 0; i < 7; i++) { const h = 2 + Math.abs(Math.sin(i * 1.7)) * 3.2; const b = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), stoneMat(ctx, 0x8c7c5c)); b.position.set(-12 + i * 4, h / 2, townZ - (i % 2) * 1.2); world.add(b); }
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 6.5, 10), stoneMat(ctx, 0x8c7c5c)); tower.position.set(-13, 3.25, townZ); world.add(tower);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 10), ctx.toon({ color: 0x5a3a28 })); cone.position.set(-13, 7.3, townZ); world.add(cone);
  // a Gothic spire
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4, 8), ctx.toon({ color: 0x55524a })); spire.position.set(4, 6, townZ - 1); world.add(spire);

  // river with a sailboat
  if (p.river !== false) {
    const river = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshStandardMaterial({ color: 0x4a6e78, transparent: true, opacity: 0.7, roughness: 0.2 }));
    river.rotation.x = -Math.PI / 2; river.position.set(0, 0.05, townZ + 5); world.add(river);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.5), ctx.toon({ color: 0x4a3420 })); hull.position.set(3, 0.35, townZ + 5); world.add(hull);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), new THREE.MeshBasicMaterial({ color: 0xece2cb, side: THREE.DoubleSide })); sail.position.set(3, 1.1, townZ + 5); world.add(sail);
  }

  // far mountain range
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(4 + (i % 3), 5 + (i % 2) * 3, 5), ctx.toon({ color: 0x6f6655 })); m.position.set(-20 + i * 8, 2.2, -26); world.add(m); }

  // Merian's rolled cloud-scrolls — a high band of overlapping flattened puffs
  for (let i = 0; i < 10; i++) { const cl = new THREE.Mesh(new THREE.SphereGeometry(2.4, 14, 8), new THREE.MeshBasicMaterial({ color: 0xe4d8bc, transparent: true, opacity: 0.45 })); cl.position.set(-18 + i * 4, 12 + Math.sin(i * 1.3) * 1.6, -20 - (i % 2) * 2); cl.scale.set(1.3, 0.5, 0.6); world.add(cl); }

  // low foreground bushes flanking the figure (the gnarled shrubs in the plates)
  for (const sx of [-1, 1]) { for (let i = 0; i < 3; i++) { const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.3, 0), ctx.toon({ color: i % 2 ? 0x47512f : 0x55603a })); bush.position.set(sx * (6 + i * 1.4), 0.4, 4 - i * 1.5); world.add(bush); } }

  const sun = new THREE.PointLight(0xfff2d6, 1.2, 40, 2); sun.position.set(6, 14, -6); sun.userData.base = sun.intensity; world.add(sun); anim.lums.push(sun);

  return {
    spawn: { pos: V(0, 1.7, 11), look: V(0, 2, townZ) },
    bounds: { minX: -20, maxX: 20, minZ: -10, maxZ: 20 },
    anchors: { central: V(0, 0, 3), actors: V(0, 0, 4.5), creature: V(-4, 0, 2), scenery: V(-8, 0, -4), sky: V(0, 10, -12) },
    plate: { pos: [0, 6, -9], w: 6, h: 5, rotY: 0 },
  };
}

// ---------------------------------------------------------------------------
// Diagram wall — a walled yard whose back wall carries a geometric figure
// ---------------------------------------------------------------------------
export function diagramWall(env, p = {}) {
  const desc = walledCourt(env, { ...p, arch: false, w: 20, d: 18 });
  const { ctx, world } = env;
  const backZ = -9, ink = ctx.toon({ color: 0x2a2018 });
  // the great circle, inscribed triangle, and square, drawn as thin rings on the wall
  const circle = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.06, 8, 48), ink); circle.position.set(2, 4, backZ + 0.35); world.add(circle);
  const tri = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 8, 3), ink); tri.position.set(2, 4, backZ + 0.35); tri.rotation.z = Math.PI / 6; world.add(tri);
  const square = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 8, 4), ink); square.position.set(2, 3.4, backZ + 0.35); square.rotation.z = Math.PI / 4; world.add(square);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 32), ink); inner.position.set(2, 3.4, backZ + 0.35); world.add(inner);
  // the coniunctio pair inside the inner circle
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 8), ctx.toon({ color: 0xc2a07e })); f.position.set(2 + sx * 0.4, 3.4, backZ + 0.4); world.add(f); }
  desc.anchors.actors = V(-5, 0, 3);   // the alchemist stands at the near-left paving with the compass
  desc.anchors.central = V(2, 0, backZ + 2);
  return desc;
}

const ARMATURES = { interiorBox, walledCourt, figureLandscape, diagramWall };

// Which armature a plate uses, from its LOCATION setting (locations.js) plus a
// few per-plate overrides where the engraving's space is special.
const SETTING_ARMATURE = {
  library: "interiorBox", cottage: "interiorBox", laboratory: "interiorBox", workshop: "interiorBox", kitchen: "interiorBox", bathhouse: "interiorBox",
  courtyard: "walledCourt", castle: "walledCourt", temple: "walledCourt",
  farm: "figureLandscape", garden: "figureLandscape", hillside: "figureLandscape", riverside: "figureLandscape", seaside: "figureLandscape", cave: "figureLandscape",
};
const NUMBER_OVERRIDE = { 21: "diagramWall" };

export function armatureFor(n, setting) {
  return NUMBER_OVERRIDE[n] || SETTING_ARMATURE[setting] || "figureLandscape";
}

// Per-setting armature parameters — which interior features each kind of room
// carries (a kitchen has a hearth + window + dish-shelves; a library has
// shelves + a reading window; a court has its arch; a landscape its river),
// read off the corresponding plates.
const SETTING_PARAMS = {
  kitchen:    { floor: "wood",   wall: 0x8c7c5c, hearth: true, window: true, shelves: true },
  library:    { floor: "wood",   wall: 0x6a5c44, shelves: true, window: true },
  laboratory: { floor: "cobble", wall: 0x6f5a40, hearth: true, window: true },
  workshop:   { floor: "cobble", wall: 0x6f5a40, hearth: true },
  cottage:    { floor: "wood",   wall: 0x8c7c5c, hearth: true, window: true },
  bathhouse:  { floor: "cobble", wall: 0x7a6a58, window: true },
  courtyard:  { floor: "cobble", arch: true },
  castle:     { floor: "cobble", arch: true },
  temple:     { floor: "cobble", arch: false },
  farm:       { floor: "soil" },
  garden:     { floor: "grass" },
  hillside:   { floor: "grass" },
  riverside:  { floor: "grass", river: true },
  seaside:    { floor: "sand", river: true },
  cave:       { floor: "cobble", arch: false },
};

export function paramsFor(setting) {
  return SETTING_PARAMS[setting] || { floor: "grass" };
}

export function buildSpace(key, env, params) {
  const fn = ARMATURES[key] || figureLandscape;
  return fn(env, params);
}

import * as THREE from "three";
import { makeStoneFacadeTexture } from "./textures.js?v=2";

// ===========================================================================
// props.js — a library of reusable low-poly 3D props keyed to the emblem
// "visual_elements" tags from the catalogue. The scene engine routes each
// tag to a builder; unknown tags get a carved plinth so nothing is dropped.
// ===========================================================================

const toonFallback = (o) => new THREE.MeshStandardMaterial({ ...o, roughness: 0.85 });

function ctxMat(ctx, opts) {
  return ctx && ctx.toon ? ctx.toon(opts) : toonFallback(opts);
}

// stone-textured variant, for architecture (buildings, columns) so masonry
// reads as coursed stonework instead of a flat-shaded box
function ctxStoneMat(ctx, baseHex) {
  const map = makeStoneFacadeTexture("#" + baseHex.toString(16).padStart(6, "0"));
  return ctxMat(ctx, { color: 0xffffff, map });
}

// --- a simple humanoid figure -------------------------------------------------
// opts.dress: "gown" (floor-length skirt, the standard female silhouette in
// Merian's plates), "hat" (brimmed traveller's hat, the standard male one),
// "crown" (kings/queens), or "none". Defaults to "hat".
export function makeFigure(ctx, opts = {}) {
  const skin = ctxMat(ctx, { color: opts.skin ?? 0xc2a07e });
  const cloth = ctxMat(ctx, { color: opts.cloth ?? 0x7a4a3a });
  const s = opts.scale ?? 1;
  const dress = opts.dress ?? "hat";
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34 * s, 0.8 * s, 4, 8), cloth);
  torso.position.y = 1.45 * s; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25 * s, 14, 14), skin);
  head.position.y = 2.2 * s; head.castShadow = true; g.add(head);
  if (dress === "gown") {
    // floor-length skirt replaces visible legs
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.52 * s, 1.25 * s, 12), cloth);
    skirt.position.y = 0.62 * s; skirt.castShadow = true; g.add(skirt);
  } else {
    for (const lx of [-0.17, 0.17]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15 * s, 0.8 * s, 4, 8), skin);
      leg.position.set(lx * s, 0.58 * s, 0); leg.castShadow = true; g.add(leg);
    }
    // a short tunic hem over the hips — Merian's men wear doublets, not bare torsos
    const hem = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s, 0.42 * s, 10), cloth);
    hem.position.y = 0.95 * s; g.add(hem);
  }
  for (const lx of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11 * s, 0.7 * s, 4, 8), skin);
    arm.position.set(lx * s, 1.5 * s, 0.04); arm.rotation.z = lx < 0 ? 0.3 : -0.3; g.add(arm);
  }
  if (dress === "hat") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * s, 0.36 * s, 0.04 * s, 14), ctxMat(ctx, { color: 0x3a2e1e }));
    brim.position.y = 2.38 * s; g.add(brim);
    const crownM = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.21 * s, 0.22 * s, 12), ctxMat(ctx, { color: 0x3a2e1e }));
    crownM.position.y = 2.5 * s; g.add(crownM);
  } else if (dress === "crown") {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.24 * s, 0.18 * s, 8),
      ctxMat(ctx, { color: 0xd9b44a, emissive: 0x4a3a10, emissiveIntensity: 0.4 }));
    crown.position.y = 2.44 * s; g.add(crown);
  } else if (dress === "gown") {
    // simple coif/headscarf
    const coif = new THREE.Mesh(new THREE.SphereGeometry(0.27 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), ctxMat(ctx, { color: 0xd8cdb0 }));
    coif.position.y = 2.24 * s; g.add(coif);
  }
  return g;
}

function tree(ctx) {
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 8), ctxMat(ctx, { color: 0x4a3420 })), 0, 1.6, 0));
  for (let i = 0; i < 5; i++)
    g.add(pos(new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), ctxMat(ctx, { color: i % 2 ? 0x55603a : 0x47512f })),
      (i % 2 ? 0.6 : -0.6), 3.1 + i * 0.5, (i % 3 - 1) * 0.4));
  return g;
}
function mountain(ctx) {
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.ConeGeometry(2.4, 4.2, 6), ctxMat(ctx, { color: 0x6f6655 })), 0, 2.1, 0));
  g.add(pos(new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.0, 6), ctxMat(ctx, { color: 0x7d735c })), 2.2, 1.5, -0.6));
  return g;
}
function water(ctx) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x4a6e78, transparent: true, opacity: 0.6, roughness: 0.2 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; return m;
}
// dry ground: sown fields, meadows, the "white foliated earth" — a raised
// patch of tilled soil, distinct from the water() pond so a "field" tag
// doesn't render as a pool.
function terrain(ctx, color) {
  const g = new THREE.Group();
  const patch = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.22, 20),
    ctxMat(ctx, { color: color ?? 0x7a6a3e }));
  patch.position.y = 0.1; patch.receiveShadow = true; g.add(patch);
  for (let i = 0; i < 6; i++) {
    const furrow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.12), ctxMat(ctx, { color: 0x5c4e28 }));
    furrow.position.set(0, 0.22, -1.3 + i * 0.52); g.add(furrow);
  }
  return g;
}
// a small stone building — farmhouse / cottage / turret, built from the same
// blocky vocabulary as the Emblem VIII townscape, for the many emblems whose
// visual_elements are tagged "classical_architecture" / "classical_scene" /
// "classical_columns" / "classical_landscape" / "garden_walls".
function building(ctx) {
  const stone = ctxStoneMat(ctx, 0x8c7c5c);
  const roof = ctxMat(ctx, { color: 0x5a3a28 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.0), stone);
  body.position.y = 1.0; body.castShadow = true; g.add(body);
  const roofM = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.3, 4), roof);
  roofM.position.y = 2.65; roofM.rotation.y = Math.PI / 4; g.add(roofM);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.08), ctxMat(ctx, { color: 0x3a2a18 }));
  door.position.set(0, 0.45, 1.02); g.add(door);
  return g;
}
// a fired kiln with a clay vessel beside it — the potter's work (Emblem XV).
function kiln(ctx) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.4, 12), ctxMat(ctx, { color: 0x7a4a30 }));
  body.position.y = 0.7; g.add(body);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  mouth.position.set(0, 0.5, 0.86); g.add(mouth);
  const jar = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), ctxMat(ctx, { color: 0xb07a4a }));
  jar.scale.set(1, 1.3, 1); jar.position.set(1.1, 0.35, 0); g.add(jar);
  return g;
}
// raw ore / the goldsmith's metal — a rough nugget on a small anvil block.
function oreProp(ctx) {
  const g = new THREE.Group();
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.6), ctxMat(ctx, { color: 0x4a4438 }));
  anvil.position.y = 0.2; g.add(anvil);
  const nugget = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0),
    ctxMat(ctx, { color: 0xd9b44a, emissive: 0x4a3a10, emissiveIntensity: 0.35 }));
  nugget.position.y = 0.62; g.add(nugget);
  return g;
}
// wedding bed / chamber furnishing (Emblem XXI, the chymical wedding).
function bed(ctx) {
  const wood = ctxMat(ctx, { color: 0x5c4228 });
  const cloth = ctxMat(ctx, { color: 0x8a3a3a });
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.3), wood), 0, 0.4, 0));
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.2), cloth), 0, 0.6, 0));
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), wood), -0.9, 0.85, -0.55));
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), wood), 0.9, 0.85, -0.55));
  return g;
}
function luminary(ctx, color, glow) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 20),
    new THREE.MeshBasicMaterial({ color })));
  const l = new THREE.PointLight(glow ?? color, 2.5, 20, 2); g.add(l);
  g.userData.flicker = false; return g;
}
function fire(ctx) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.3 - i * 0.04, 0.9 + i * 0.2, 10),
      new THREE.MeshBasicMaterial({ color: i < 2 ? 0xffd27a : 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.position.y = 0.5 + i * 0.16; g.add(f);
  }
  g.add(new THREE.PointLight(0xff7a1a, 3, 10, 2));
  g.userData.flame = true; return g;
}
function egg(ctx) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32),
    ctxMat(ctx, { color: 0xece2cb, emissive: 0x3a3220, emissiveIntensity: 0.4 }));
  m.scale.set(1, 1.35, 1); m.position.y = 0.8; m.castShadow = true; return m;
}
function sword(ctx) {
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.6, 0.13),
    ctxMat(ctx, { color: 0xffe0ad, emissive: 0xff7a1a, emissiveIntensity: 1.2 })), 0, 1.5, 0));
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.12), ctxMat(ctx, { color: 0x3a2a18 })), 0, 0.7, 0));
  return g;
}
function vessel(ctx) {
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe3da, transparent: true, opacity: 0.4, roughness: 0.08 });
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), glass), 0, 0.5, 0));
  g.add(pos(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 12), glass), 0, 1.0, 0));
  return g;
}
function column(ctx) {
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 4, 14), ctxStoneMat(ctx, 0x9b917a)), 0, 2, 0));
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), ctxMat(ctx, { color: 0xaaa288 })), 0, 4.1, 0));
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), ctxMat(ctx, { color: 0xaaa288 })), 0, 0.15, 0));
  return g;
}
function table(ctx) {
  const w = ctxMat(ctx, { color: 0x6e5436 });
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.2), w), 0, 1, 0));
  for (const lx of [-1, 1]) for (const lz of [-0.45, 0.45])
    g.add(pos(new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.16), w), lx, 0.5, lz));
  return g;
}
function beast(ctx, color, long) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, long ? 1.8 : 0.9, 4, 8), ctxMat(ctx, { color }));
  body.rotation.z = Math.PI / 2; body.position.y = 0.7; g.add(body);
  for (const lx of [-0.5, 0.5]) for (const lz of [-0.3, 0.3])
    g.add(pos(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), ctxMat(ctx, { color })), lx, 0.3, lz));
  g.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), ctxMat(ctx, { color })), long ? 1.1 : 0.7, 0.9, 0));
  return g;
}
function serpent(ctx) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++)
    g.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.34 - i * 0.025, 10, 10), ctxMat(ctx, { color: 0x4d6b3a })),
      Math.sin(i * 0.7) * 1.2, 0.4 + Math.cos(i * 0.5) * 0.2, i * 0.5 - 1.8));
  return g;
}
function bird(ctx) {
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), ctxMat(ctx, { color: 0x6b5840 })), 0, 0, 0));
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.22), ctxMat(ctx, { color: 0x4a3a28 }));
    w.position.set(s * 0.3, 0.05, 0); w.rotation.z = s * 0.4; g.add(w);
  }
  g.position.y = 2.4; return g;
}
function orb(ctx, color) { // apple / seed / gold / sun-token
  return pos(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16),
    ctxMat(ctx, { color: color ?? 0xd9b44a, emissive: 0x4a3a10, emissiveIntensity: 0.4 })), 0, 0.7, 0);
}
function plinth(ctx) { // generic fallback
  const g = new THREE.Group();
  g.add(pos(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.0, 8), ctxMat(ctx, { color: 0x837a64 })), 0, 0.5, 0));
  g.add(pos(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), ctxMat(ctx, { color: 0xb0a487 })), 0, 1.2, 0));
  return g;
}
function pos(m, x, y, z) { m.position.set(x, y, z); return m; }

// --- tag -> builder routing --------------------------------------------------
function route(tag) {
  const t = tag.toLowerCase();
  const has = (...k) => k.some((x) => t.includes(x));
  if (has("infant", "child", "baby")) return (c) => makeFigure(c, { scale: 0.5, cloth: 0xd8cdb0, dress: "none" });
  if (has("queen")) return (c) => makeFigure(c, { cloth: 0x6a3a5a, dress: "crown" });
  if (has("king")) return (c) => makeFigure(c, { cloth: 0x7a2a2a, dress: "crown" });
  if (has("woman", "sister", "nurse", "venus", "latona", "isis", "ceres")) return (c) => makeFigure(c, { cloth: 0x6a4a6a, dress: "gown" });
  if (has("man", "brother", "farmer", "philosopher", "boreas", "wind_bell", "oedipus", "swordsman", "figure", "salamander", "triptolemus")) return (c) => makeFigure(c, {});
  if (has("hand_divine", "hand")) return (c) => makeFigure(c, { scale: 0.7, cloth: 0xcfc6a8, dress: "none" });
  if (has("tree", "garden", "rose", "forest", "foliage")) return tree;
  if (has("mountain", "rock", "hill")) return mountain;
  if (has("water", "stream", "river", "sea", "bath", "milk", "blood", "dew")) return water;
  if (has("meadow", "field", "landscape", "ground", "white_earth")) return (c) => terrain(c);
  if (has("classical_architecture", "classical_scene", "classical_landscape", "classical_setting", "garden_walls")) return building;
  if (has("kiln", "potter")) return kiln;
  if (has("gold_ore", "ore_vessel")) return oreProp;
  if (has("sun", "sol", "radiance", "light", "gold_rain")) return (c) => luminary(c, 0xffe9a8, 0xffd86a);
  if (has("moon", "luna")) return (c) => luminary(c, 0xdfe6ef, 0xaebfd0);
  if (has("fire", "flame", "furnace", "forge")) return fire;
  if (has("egg", "ovum", "cosmic_egg")) return egg;
  if (has("sword", "gladius", "lance", "blade")) return sword;
  if (has("clay_vessel")) return kiln;
  if (has("vessel", "flask", "retort", "alembic", "cucurbit", "vase", "cup", "wine")) return vessel;
  if (has("column", "pillar", "temple", "classical_columns")) return column;
  if (has("bed", "wedding_chamber")) return bed;
  if (has("table", "altar", "wedding", "bench")) return table;
  if (has("dragon", "serpent", "snake")) return serpent;
  if (has("lion")) return (c) => beast(c, 0xb98a3a, false);
  if (has("wolf", "dog")) return (c) => beast(c, 0x6a6258, true);
  if (has("toad", "frog")) return (c) => beast(c, 0x5a6b48, false);
  if (has("eagle", "bird", "phoenix", "nest", "raven", "crow", "owl")) return bird;
  if (has("apple", "seed", "fruit", "stone", "pearl", "diadem")) return (c) => orb(c, 0xd9b44a);
  return null;
}

// Build a prop group for a tag. Returns {group, kind} (kind hints layout/anim).
// Some builders (egg, orb, water) return a bare Mesh with its display offset
// baked into its own position — wrap it in a Group so scene.js's place() can
// reposition the prop without clobbering that internal offset.
export function buildProp(ctx, tag) {
  const b = route(tag) || plinth;
  let result = b(ctx);
  if (!result.isGroup) {
    const wrapper = new THREE.Group();
    wrapper.add(result);
    result = wrapper;
  }
  result.userData.tag = tag;
  return result;
}

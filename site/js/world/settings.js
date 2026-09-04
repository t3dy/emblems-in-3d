import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Extrude/Shape geometries come out non-indexed while the primitives are
// indexed, and mergeGeometries refuses a mixed list. Normalise once, here, so
// no module builder has to remember.
function merge(list) {
  const norm = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  if (!norm.length) return null;
  const out = mergeGeometries(norm, false);
  if (!out) console.warn("[settings] merge failed", norm.map((g) => Object.keys(g.attributes).join("+") + "/" + (g.index ? "idx" : "flat")));
  return out;
}

// ===========================================================================
// settings.js — the places the emblems are set in, generated.
//
// locations.js already assigns every emblem a setting archetype read off
// Maier's OWN text (III's washerwoman -> riverside, VI's "sow your gold in the
// white foliated earth" -> farm, XXII's "then do woman's work, that is to say:
// cook" -> kitchen). Until now that was a list of background prop tags. Here it
// becomes built architecture and landscape, so each of the 51 stations stands
// in a place rather than in a void.
//
// The generator keeps the compilation boundary that the architecture skill
// insists on: DECIDE the building, THEN emit triangles.
//
//   archetype + seed
//     -> planSetting()      pieces (rectangular footprints), exposed edges,
//                           module placements, props            [inspectable]
//     -> compileSetting()   one merged BufferGeometry per material slot
//
// planSetting() returns a serialisable plan with diagnostics; nothing in it is
// a Mesh. That is what makes the kit testable and what lets the world print
// per-station module and triangle counts instead of guessing at cost.
//
// Dimensional anchors are real metres, chosen for 1600-ish vernacular rather
// than for a modern floorplate:
// ===========================================================================

export const BAY_W = 2.6;      // one arcade bay / one window bay
export const FLOOR_H = 3.1;    // ground-floor height
export const WALL_T = 0.42;    // masonry thickness
export const PIER_W = 0.62;

const SLOTS = ["stone", "timber", "green", "water"];

// --- deterministic randomness ---------------------------------------------
/** mulberry32 — one seed per station, so a station is the same every reload. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rr = (r, a, b) => a + (b - a) * r();

// ===========================================================================
// module builders — each returns a BufferGeometry already placed in the
// station's local frame (x right, y up, z into the bay), plus its slot.
// Poly budgets are deliberately small: 51 of these exist at once.
// ===========================================================================

function box(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function cyl(rt, rb, h, x, y, z, seg = 8) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1);
  g.translate(x, y, z);
  return g;
}

function cone(r, h, x, y, z, seg = 7) {
  const g = new THREE.ConeGeometry(r, h, seg, 1);
  g.translate(x, y, z);
  return g;
}

function sphereish(r, x, y, z, detail = 0) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.translate(x, y, z);
  return g;
}

/** A wall panel with round-headed openings cut through it — one extrude, so an
 *  arcade costs the same as a wall. This is the workhorse of the whole kit. */
function archWall(len, h, bays, { thickness = WALL_T, open = true, sill = 0, headFrac = 0.62 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, 0);
  shape.lineTo(len / 2, 0);
  shape.lineTo(len / 2, h);
  shape.lineTo(-len / 2, h);
  shape.closePath();

  if (open && bays > 0) {
    const bw = len / bays;
    // An opening is a door or a window, never the whole wall: cap it against
    // the storey height as well as the bay, or a one-bay range degenerates
    // into a thin arch ring standing on its own.
    const ow = Math.max(0.5, Math.min(bw - PIER_W, (h - sill) * 0.72));
    const springing = sill + (h - sill) * headFrac;
    for (let i = 0; i < bays; i++) {
      const cx = -len / 2 + bw * (i + 0.5);
      const hole = new THREE.Path();
      hole.moveTo(cx - ow / 2, sill);
      hole.lineTo(cx - ow / 2, springing);
      hole.absarc(cx, springing, ow / 2, Math.PI, 0, true);
      hole.lineTo(cx + ow / 2, sill);
      hole.closePath();
      shape.holes.push(hole);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: false, curveSegments: 5,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

/** Gabled roof as two slabs plus two tympana. Cheap, and it reads. */
function gableRoof(w, d, rise, x, y, z, ry = 0) {
  const parts = [];
  const slope = Math.atan2(rise, d / 2);
  const len = Math.hypot(rise, d / 2);
  for (const s of [1, -1]) {
    const g = new THREE.BoxGeometry(w, 0.16, len);
    g.rotateX(s * slope);
    g.translate(0, y + rise / 2, z + (s * d) / 4);
    parts.push(g);
  }
  const tri = new THREE.Shape();
  tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, rise); tri.closePath();
  for (const s of [1, -1]) {
    const g = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate((s * w) / 2, y, z);
    parts.push(g);
  }
  const merged = merge(parts);
  if (ry) merged.rotateY(ry);
  merged.translate(x, 0, 0);
  return merged;
}

function column(h, r, x, z) {
  return merge([
    box(r * 2.6, 0.18, r * 2.6, x, 0.09, z),
    cyl(r * 0.86, r, h - 0.34, x, 0.18 + (h - 0.34) / 2, z, 9),
    box(r * 2.5, 0.16, r * 2.5, x, h - 0.08, z),
  ]);
}

function crenellatedWall(len, h, x, z, ry = 0) {
  const parts = [box(len, h, WALL_T, 0, h / 2, 0)];
  const n = Math.max(3, Math.round(len / 1.1));
  for (let i = 0; i < n; i += 2) {
    parts.push(box(len / n, 0.55, WALL_T, -len / 2 + (len / n) * (i + 0.5), h + 0.27, 0));
  }
  const g = merge(parts);
  if (ry) g.rotateY(ry);
  g.translate(x, 0, z);
  return g;
}

/** A canopy is three overlapping lobes on a leaning bole, at detail 1 so the
 *  silhouette is lumpy rather than crystalline. Merian draws foliage as a mass
 *  of small round clumps, not as a ball, and the silhouette is the only part of
 *  a tree that survives at this poly budget. */
function tree(r, x, z, h = 4.2) {
  const parts = [cyl(0.11, 0.19, h * 0.52, x, h * 0.26, z, 6)];
  const lobes = [
    [0.0, 0.70, 0.0, 0.30],
    [0.20, 0.56, -0.10, 0.24],
    [-0.19, 0.60, 0.11, 0.22],
    [0.04, 0.84, 0.02, 0.19],
  ];
  for (const [dx, dy, dz, rr_] of lobes) {
    const g = new THREE.IcosahedronGeometry(h * rr_, 1);
    g.scale(1, 0.86, 1);
    g.translate(x + h * dx, h * dy, z + h * dz);
    parts.push(g);
  }
  return merge(parts);
}

function furnace(x, z, ry = 0) {
  const g = merge([
    box(1.5, 1.25, 1.2, 0, 0.62, 0),
    box(1.25, 0.9, 0.24, 0, 0.55, 0.6),      // the mouth surround
    cyl(0.34, 0.46, 1.5, 0, 2.0, 0, 8),      // the hood
    cyl(0.26, 0.3, 2.4, 0, 3.9, 0, 8),       // the flue
  ]);
  if (ry) g.rotateY(ry);
  g.translate(x, 0, z);
  return g;
}

function kiln(x, z) {
  return merge([
    cyl(1.0, 1.25, 1.9, x, 0.95, z, 10),
    cyl(0.34, 0.95, 1.0, x, 2.4, z, 10),
    box(0.7, 0.75, 0.5, x, 0.4, z + 1.15),
  ]);
}

function bench(x, z, w = 2.2, ry = 0) {
  const g = merge([
    box(w, 0.09, 0.72, 0, 0.86, 0),
    box(0.12, 0.86, 0.62, -w / 2 + 0.14, 0.43, 0),
    box(0.12, 0.86, 0.62, w / 2 - 0.14, 0.43, 0),
  ]);
  if (ry) g.rotateY(ry);
  g.translate(x, 0, z);
  return g;
}

function vessels(x, z, r) {
  const parts = [];
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const px = x + rr(r, -0.9, 0.9);
    const pz = z + rr(r, -0.3, 0.3);
    const h = rr(r, 0.22, 0.44);
    parts.push(cyl(rr(r, 0.05, 0.1), rr(r, 0.12, 0.2), h, px, 0.95 + h / 2, pz, 7));
  }
  return merge(parts);
}

/** A stepped mass: the Hypnerotomachia's great pyramid is 1,410 steps in the
 *  text, which is Colonna being Colonna. Fourteen reads at this distance. */
function stepped(base, h, steps, x, z) {
  const parts = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const w = base * (1 - t * 0.92);
    parts.push(box(w, h / steps, w, x, (h / steps) * (i + 0.5), z));
  }
  return merge(parts);
}

function obelisk(h, r, x, z, y0 = 0) {
  return merge([
    box(r * 3.2, h * 0.06, r * 3.2, x, y0 + h * 0.03, z),
    cyl(r * 0.42, r, h * 0.82, x, y0 + h * 0.06 + h * 0.41, z, 4),
    cone(r * 0.6, h * 0.12, x, y0 + h * 0.94, z, 4),
  ]);
}

function sarcophagus(x, z, ry = 0) {
  const g = merge([
    box(2.6, 0.9, 1.15, 0, 0.45, 0),
    box(2.9, 0.18, 1.4, 0, 0.98, 0),
    box(2.4, 0.42, 1.0, 0, 1.25, 0),
    box(0.3, 0.5, 0.3, -1.1, 0.25, 0),
    box(0.3, 0.5, 0.3, 1.1, 0.25, 0),
  ]);
  if (ry) g.rotateY(ry);
  g.translate(x, 0, z);
  return g;
}

function basin(x, z, r = 3.2) {
  return merge([
    cyl(r, r * 1.08, 0.5, x, 0.25, z, 16),
    cyl(r * 0.92, r * 0.92, 0.12, x, 0.52, z, 16),
    cyl(r * 0.22, r * 0.3, 1.1, x, 1.05, z, 10),
    cyl(r * 0.55, r * 0.2, 0.28, x, 1.72, z, 12),
  ]);
}

function rocks(x, z, r, n = 5, scale = 1) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const s = rr(r, 0.4, 1.5) * scale;
    parts.push(sphereish(s, x + rr(r, -4, 4), s * 0.42, z + rr(r, -3, 3), 0));
  }
  return merge(parts);
}

function tilledRows(x, z, r, w = 12, d = 8) {
  const parts = [];
  const n = Math.round(d / 0.85);
  for (let i = 0; i < n; i++) {
    parts.push(box(w, 0.14, 0.34, x, 0.07, z - d / 2 + (d / n) * (i + 0.5)));
  }
  return merge(parts);
}

function fence(x, z, len, ry = 0) {
  const parts = [];
  const n = Math.round(len / 1.3);
  for (let i = 0; i <= n; i++) parts.push(box(0.11, 1.1, 0.11, -len / 2 + (len / n) * i, 0.55, 0));
  parts.push(box(len, 0.08, 0.07, 0, 0.92, 0));
  parts.push(box(len, 0.08, 0.07, 0, 0.52, 0));
  const g = merge(parts);
  if (ry) g.rotateY(ry);
  g.translate(x, 0, z);
  return g;
}

// ===========================================================================
// the plan
// ===========================================================================

/**
 * Decide the setting. Emits NO triangles.
 * @param {string} archetype  one of the 15 in locations.js SETTINGS
 * @param {number} seed       the station index, so the place is stable
 * @returns {object} plan
 */
export function planSetting(archetype, seed) {
  const r = rng(seed * 2654435761);
  const plan = {
    archetype,
    seed,
    pieces: [],       // rectangular footprints, for the exposed-edge pass
    modules: [],      // { id, slot, ...params }
    diagnostics: {},
  };
  const M = (id, slot, p = {}) => plan.modules.push({ id, slot, ...p });

  // The bay is a 22 x 18 m stage. Everything is placed relative to its centre,
  // with -Z away from the road, so the emblem always faces the walker.
  const BAY_HALF_W = 11, BACK = -8.5;

  switch (archetype) {
    case "courtyard": {
      plan.pieces.push({ x: 0, z: BACK, w: 18, d: 0.5, role: "range" });
      M("archWall", "stone", { len: 17, h: FLOOR_H * 1.6, bays: 6, x: 0, z: BACK, ry: 0 });
      M("archWall", "stone", { len: 13, h: FLOOR_H * 1.6, bays: 5, x: -8.6, z: BACK + 6.5, ry: Math.PI / 2 });
      M("archWall", "stone", { len: 13, h: FLOOR_H * 1.6, bays: 5, x: 8.6, z: BACK + 6.5, ry: Math.PI / 2 });
      M("cornice", "stone", { len: 18, h: FLOOR_H * 1.6, z: BACK });
      M("pavement", "stone", { w: 18, d: 14, z: BACK + 7 });
      break;
    }
    case "temple": {
      M("steps", "stone", { w: 12, d: 3.2, z: BACK + 7.5, n: 4 });
      for (let i = 0; i < 6; i++) {
        M("column", "stone", { h: 5.4, r: 0.42, x: -5 + i * 2, z: BACK + 5.6 });
      }
      M("entablature", "stone", { w: 12.4, z: BACK + 5.6, y: 5.4 });
      M("pediment", "stone", { w: 12.4, z: BACK + 5.6, y: 5.9 });
      M("archWall", "stone", { len: 12, h: 6.2, bays: 1, x: 0, z: BACK, ry: 0 });
      break;
    }
    case "castle": {
      M("crenel", "stone", { len: 16, h: 5.4, x: 0, z: BACK });
      M("tower", "stone", { r: 2.3, h: 9.5, x: -7.6, z: BACK + 0.6 });
      M("tower", "stone", { r: 1.9, h: 7.6, x: 7.9, z: BACK + 0.6 });
      M("archWall", "stone", { len: 4.2, h: 4.4, bays: 1, x: 0, z: BACK + 0.1 });
      break;
    }
    case "laboratory": {
      plan.pieces.push({ x: 0, z: BACK, w: 15, d: 9, role: "hall" });
      M("archWall", "stone", { len: 15, h: FLOOR_H * 1.5, bays: 4, x: 0, z: BACK, sill: 1.5 });
      M("archWall", "stone", { len: 9, h: FLOOR_H * 1.5, bays: 3, x: -7.4, z: BACK + 4.4, ry: Math.PI / 2, sill: 1.5 });
      M("archWall", "stone", { len: 9, h: FLOOR_H * 1.5, bays: 3, x: 7.4, z: BACK + 4.4, ry: Math.PI / 2, sill: 1.5 });
      M("gable", "timber", { w: 15.4, d: 9.2, rise: 2.4, y: FLOOR_H * 1.5, z: BACK + 4.4 });
      M("furnace", "stone", { x: -4.6, z: BACK + 1.4 });
      M("furnace", "stone", { x: 4.9, z: BACK + 1.4, ry: 0 });
      M("bench", "timber", { x: 0, z: BACK + 3.4, w: 3.4 });
      M("vessels", "timber", { x: 0, z: BACK + 3.4 });
      M("pavement", "stone", { w: 15, d: 9, z: BACK + 4.4 });
      break;
    }
    case "workshop": {
      M("archWall", "stone", { len: 12, h: 3.6, bays: 3, x: 0, z: BACK, sill: 1.2 });
      M("gable", "timber", { w: 12.4, d: 8, rise: 2.1, y: 3.6, z: BACK + 4 });
      M("kiln", "stone", { x: -4.2, z: BACK + 2.4 });
      M("bench", "timber", { x: 3.2, z: BACK + 3.2, w: 2.8 });
      M("vessels", "timber", { x: 3.2, z: BACK + 3.2 });
      break;
    }
    case "kitchen": {
      M("archWall", "stone", { len: 12, h: 3.4, bays: 2, x: 0, z: BACK, sill: 1.4 });
      M("hearth", "stone", { x: -3.6, z: BACK + 0.6 });
      M("gable", "timber", { w: 12.4, d: 8.4, rise: 2.2, y: 3.4, z: BACK + 4.2 });
      M("bench", "timber", { x: 2.4, z: BACK + 4.2, w: 3.0 });
      M("vessels", "timber", { x: 2.4, z: BACK + 4.2 });
      break;
    }
    case "library": {
      M("archWall", "stone", { len: 14, h: 5.2, bays: 5, x: 0, z: BACK, sill: 2.1, headFrac: 0.5 });
      M("shelving", "timber", { w: 13, h: 3.2, z: BACK + 0.6 });
      M("gable", "timber", { w: 14.4, d: 9, rise: 2.0, y: 5.2, z: BACK + 4.5 });
      M("pavement", "stone", { w: 14, d: 9, z: BACK + 4.5 });
      break;
    }
    case "cottage": {
      M("archWall", "stone", { len: 8.5, h: 2.9, bays: 2, x: -2.4, z: BACK + 1.5, sill: 1.1 });
      M("gable", "timber", { w: 8.9, d: 7, rise: 2.6, y: 2.9, z: BACK + 5 });
      M("chimney", "stone", { x: -6.0, z: BACK + 2.2, h: 4.9 });
      M("fence", "timber", { x: 4.5, z: BACK + 6.5, len: 9 });
      M("tree", "green", { x: 6.8, z: BACK + 1.5, h: 5.2 });
      break;
    }
    case "farm": {
      M("archWall", "stone", { len: 11, h: 4.1, bays: 2, x: -3.5, z: BACK, sill: 0, headFrac: 0.8 });
      M("gable", "timber", { w: 11.4, d: 8.4, rise: 2.9, y: 4.1, z: BACK + 4.2 });
      M("tilled", "green", { x: 5.5, z: BACK + 5, w: 10, d: 9 });
      M("fence", "timber", { x: 5.5, z: BACK + 9.6, len: 10 });
      M("tree", "green", { x: -9.4, z: BACK + 3, h: 5.6 });
      break;
    }
    case "garden": {
      M("archWall", "stone", { len: 17, h: 2.5, bays: 5, x: 0, z: BACK, sill: 1.4, headFrac: 0.55 });
      M("parterre", "green", { w: 12, d: 8, z: BACK + 5.5 });
      M("tree", "green", { x: -7.5, z: BACK + 2.5, h: 5.6 });
      M("tree", "green", { x: 7.5, z: BACK + 2.8, h: 5.0 });
      M("bench", "timber", { x: -4.4, z: BACK + 8.5, w: 2.2 });
      break;
    }
    case "riverside": {
      M("water", "water", { w: 26, d: 11, z: BACK - 1.5 });
      M("bank", "green", { w: 26, d: 3.2, z: BACK + 4.2 });
      M("rocks", "stone", { x: -6.5, z: BACK + 4.0, n: 6, scale: 0.75 });
      M("tree", "green", { x: 8.4, z: BACK + 3.2, h: 6.0 });
      M("bench", "timber", { x: 2.0, z: BACK + 5.6, w: 2.6 });
      break;
    }
    case "bathhouse": {
      M("pool", "water", { w: 9, d: 6.5, z: BACK + 4.5, rim: 0.6 });
      for (let i = 0; i < 4; i++) M("column", "stone", { h: 4.6, r: 0.36, x: -6.6 + i * 4.4, z: BACK + 0.6 });
      M("entablature", "stone", { w: 14.6, z: BACK + 0.6, y: 4.6 });
      M("pavement", "stone", { w: 15, d: 12, z: BACK + 4 });
      break;
    }
    case "seaside": {
      M("water", "water", { w: 34, d: 16, z: BACK - 4 });
      M("shore", "green", { w: 34, d: 5, z: BACK + 5.5 });
      M("rocks", "stone", { x: -9.5, z: BACK + 2.5, n: 7, scale: 1.15 });
      M("rocks", "stone", { x: 9.0, z: BACK + 1.0, n: 5, scale: 0.9 });
      break;
    }
    case "cave": {
      M("archWall", "stone", { len: 15, h: 7.5, bays: 1, x: 0, z: BACK, thickness: 2.2, headFrac: 0.42 });
      M("rocks", "stone", { x: -6.5, z: BACK + 3.5, n: 6, scale: 1.3 });
      M("rocks", "stone", { x: 6.5, z: BACK + 3.0, n: 6, scale: 1.2 });
      break;
    }
    // --- the Hypnerotomachia precincts ------------------------------------
    // These are authored at PRECINCT scale, not bay scale: a precinct is a
    // place you stand in the middle of and turn around inside, with its leaves
    // on arcs out to about 25 m. So everything built here rings a clear middle
    // at radius 32 and beyond, and main.js does not scale it.
    case "forest": {
      const rf = rng(seed * 7919 + 13);
      for (let i = 0; i < 34; i++) {
        const a = (i / 34) * Math.PI * 2 + rr(rf, -0.06, 0.06);
        const R = rr(rf, 33, 52);
        M("tree", "green", { x: Math.sin(a) * R, z: Math.cos(a) * R, h: rr(rf, 7, 13) });
      }
      for (let i = 0; i < 5; i++) {
        M("rocks", "stone", { x: rr(rf, -40, 40), z: rr(rf, -44, 30), n: 3, scale: 1.1 });
      }
      M("mound", "green", { x: -46, z: -30, r: 22, h: 11 });
      M("mound", "green", { x: 44, z: -34, r: 19, h: 9 });
      break;
    }
    case "pyramid": {
      // 1,410 steps in Colonna's text, which is Colonna being Colonna.
      M("stepped", "stone", { base: 46, h: 27, steps: 16, x: 0, z: -62 });
      M("obelisk", "stone", { h: 22, r: 1.5, x: 0, z: -62, y: 27 });
      M("archWall", "stone", { len: 18, h: 9.5, bays: 1, x: 0, z: -40, thickness: 2.0 });
      M("crenel", "stone", { len: 40, h: 5.6, x: -34, z: -30 });
      M("crenel", "stone", { len: 40, h: 5.6, x: 34, z: -30 });
      M("sarcophagus", "stone", { x: -33, z: -8, ry: 0.3 });
      M("sarcophagus", "stone", { x: 34, z: -12, ry: -0.4 });
      M("column", "stone", { h: 8.5, r: 0.7, x: -36, z: 8 });
      M("column", "stone", { h: 6.2, r: 0.7, x: 37, z: 6 });
      M("rocks", "stone", { x: -40, z: -46, n: 6, scale: 2.2 });
      M("rocks", "stone", { x: 41, z: -44, n: 6, scale: 2.0 });
      break;
    }
    case "portal": {
      M("archWall", "stone", { len: 52, h: 22, bays: 1, x: 0, z: -44, thickness: 6.5, headFrac: 0.52 });
      M("crenel", "stone", { len: 52, h: 22.5, x: 0, z: -48 });
      M("rocks", "stone", { x: -38, z: -20, n: 7, scale: 2.6 });
      M("rocks", "stone", { x: 38, z: -20, n: 7, scale: 2.6 });
      M("rocks", "stone", { x: -34, z: 14, n: 5, scale: 2.0 });
      M("rocks", "stone", { x: 35, z: 12, n: 5, scale: 2.0 });
      break;
    }
    case "palace": {
      M("archWall", "stone", { len: 56, h: 15, bays: 13, x: 0, z: -46 });
      M("cornice", "stone", { len: 58, h: 15, z: -46 });
      M("archWall", "stone", { len: 40, h: 13, bays: 9, x: -33, z: -24, ry: Math.PI / 2 });
      M("archWall", "stone", { len: 40, h: 13, bays: 9, x: 33, z: -24, ry: Math.PI / 2 });
      M("steps", "stone", { w: 26, d: 5, z: -38, n: 4 });
      M("pavement", "stone", { w: 62, d: 60, z: -18 });
      break;
    }
    case "doors": {
      // Gloria Dei, Gloria Mundi, Mater Amoris - and he takes the third.
      for (let i = -1; i <= 1; i++) {
        M("archWall", "stone", { len: 15, h: 13, bays: 1, x: i * 19, z: -42, thickness: 2.4 });
        M("entablature", "stone", { w: 16, z: -42, y: 13 });
        M("pediment", "stone", { w: 16, z: -42, y: 13.7 });
      }
      M("pavement", "stone", { w: 62, d: 46, z: -20 });
      M("column", "stone", { h: 7, r: 0.6, x: -34, z: -6 });
      M("column", "stone", { h: 7, r: 0.6, x: 34, z: -6 });
      break;
    }
    case "tomb": {
      const rt = rng(seed * 104729 + 5);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const R = rr(rt, 32, 47);
        M("sarcophagus", "stone", { x: Math.sin(a) * R, z: Math.cos(a) * R, ry: -a });
      }
      M("crenel", "stone", { len: 54, h: 6.5, x: 0, z: -50 });
      for (let i = 0; i < 6; i++) {
        M("column", "stone", { h: rr(rt, 3.5, 9), r: 0.55,
                               x: rr(rt, -44, 44), z: rr(rt, -44, 24) });
      }
      break;
    }
    case "fountain": {
      M("basin", "stone", { x: 0, z: -40, r: 9 });
      M("water", "water", { w: 19, d: 19, z: -40 });
      for (let i = 0; i < 9; i++) {
        M("column", "stone", { h: 9.5, r: 0.62, x: -32 + i * 8, z: -52 });
      }
      M("entablature", "stone", { w: 70, z: -52, y: 9.5 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        M("tree", "green", { x: Math.sin(a) * 42, z: Math.cos(a) * 42, h: rr(rng(seed + i), 6, 9) });
      }
      break;
    }
    case "processionway": {
      M("pavement", "stone", { w: 46, d: 96, z: -14 });
      for (let i = 0; i < 9; i++) {
        M("column", "stone", { h: 11, r: 0.72, x: -30, z: -54 + i * 11 });
        M("column", "stone", { h: 11, r: 0.72, x: 30, z: -54 + i * 11 });
      }
      M("archWall", "stone", { len: 30, h: 15, bays: 1, x: 0, z: -58, thickness: 3.0 });
      M("entablature", "stone", { w: 31, z: -58, y: 15 });
      break;
    }
    case "shore": {
      M("water", "water", { w: 130, d: 70, z: -78 });
      M("shore", "green", { w: 130, d: 16, z: -38 });
      M("rocks", "stone", { x: -44, z: -30, n: 7, scale: 2.2 });
      M("rocks", "stone", { x: 45, z: -32, n: 7, scale: 2.0 });
      M("column", "stone", { h: 9, r: 0.6, x: -12, z: -36 });
      M("column", "stone", { h: 9, r: 0.6, x: 12, z: -36 });
      break;
    }
    case "cythera": {
      // The island is twenty concentric zones around the amphitheatre of
      // Venus, measured to the foot. Three rings read at this scale.
      M("ringwall", "stone", { r: 46, h: 2.4, z: 0 });
      M("ringwall", "stone", { r: 36, h: 1.8, z: 0 });
      M("basin", "stone", { x: 0, z: -52, r: 8 });
      M("water", "water", { w: 17, d: 17, z: -52 });
      const rc = rng(seed * 31337 + 3);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        M("tree", "green", { x: Math.sin(a) * 41, z: Math.cos(a) * 41, h: rr(rc, 5, 8) });
      }
      break;
    }

    case "hillside":
    default: {
      M("mound", "green", { x: -8, z: BACK - 2, r: 7.5, h: 4.5 });
      M("mound", "green", { x: 9, z: BACK - 3.5, r: 9, h: 6.2 });
      M("rocks", "stone", { x: 4.5, z: BACK + 4, n: 5, scale: 0.9 });
      M("tree", "green", { x: -6.8, z: BACK + 3.5, h: 5.4 });
      M("tree", "green", { x: 7.4, z: BACK + 4.8, h: 4.2 });
      break;
    }
  }

  // A little seeded variety that selects among valid designs and never repairs
  // an invalid one: a couple of extra props at the bay's outer corners.
  const extras = 2 + Math.floor(rr(r, 0, 1.99));
  for (let i = 0; i < extras; i++) {
    const side = r() < 0.5 ? -1 : 1;
    M(archetype === "seaside" || archetype === "riverside" ? "rocks" : "tree", "green", {
      x: side * rr(r, 8.5, BAY_HALF_W + 1.5),
      z: BACK + rr(r, 6, 12),
      h: rr(r, 3.4, 5.6), n: 3, scale: 0.7,
    });
  }

  // ZONES. A station's diorama owns the axis: nothing invented may stand
  // between the viewer and the plate. So every module is classified once,
  // here, and the Station shifts only the BACK zone behind the reconstruction.
  // FLANK modules are narrow and lateral, well outside the view cone, and stay
  // where they were planned so the bay is still framed by its place.
  for (const m of plan.modules) {
    const wide = Math.max(m.len ?? 0, m.w ?? 0, (m.r ?? 0) * 2) > 7;
    const lateral = Math.abs(m.x ?? 0) >= 6.5;
    m.zone = !wide && lateral ? "flank" : "back";
  }

  plan.diagnostics.moduleCount = plan.modules.length;
  plan.diagnostics.zones = {
    back: plan.modules.filter((m) => m.zone === "back").length,
    flank: plan.modules.filter((m) => m.zone === "flank").length,
  };
  plan.diagnostics.slots = SLOTS.filter((s) => plan.modules.some((m) => m.slot === s));
  const known = new Set(Object.keys(BUILDERS));
  plan.diagnostics.missingModuleIds = [...new Set(
    plan.modules.filter((m) => !known.has(m.id)).map((m) => m.id)
  )];
  return plan;
}

// ===========================================================================
// the mesh writer
// ===========================================================================

const BUILDERS = {
  archWall: (p, r) => {
    const g = archWall(p.len, p.h, p.bays ?? 0, {
      thickness: p.thickness ?? WALL_T, sill: p.sill ?? 0,
      headFrac: p.headFrac ?? 0.62, open: p.bays > 0,
    });
    if (p.ry) g.rotateY(p.ry);
    g.translate(p.x ?? 0, 0, p.z ?? 0);
    return g;
  },
  cornice: (p) => box(p.len + 0.6, 0.3, WALL_T + 0.5, 0, p.h + 0.15, p.z),
  entablature: (p) => box(p.w, 0.7, 1.4, 0, p.y + 0.35, p.z),
  pediment: (p) => {
    const tri = new THREE.Shape();
    tri.moveTo(-p.w / 2, 0); tri.lineTo(p.w / 2, 0); tri.lineTo(0, p.w * 0.17); tri.closePath();
    const g = new THREE.ExtrudeGeometry(tri, { depth: 1.4, bevelEnabled: false });
    g.translate(0, p.y + 0.7, p.z - 0.7);
    return g;
  },
  steps: (p) => {
    const parts = [];
    for (let i = 0; i < p.n; i++) {
      parts.push(box(p.w + i * 0.8, 0.22, p.d + i * 0.5, 0, 0.11 + (p.n - 1 - i) * 0.22, p.z + i * 0.25));
    }
    return merge(parts);
  },
  column: (p) => column(p.h, p.r, p.x, p.z),
  crenel: (p) => crenellatedWall(p.len, p.h, p.x, p.z),
  tower: (p) => merge([
    cyl(p.r, p.r * 1.12, p.h, p.x, p.h / 2, p.z, 10),
    cyl(p.r * 1.2, p.r * 1.2, 0.4, p.x, p.h + 0.2, p.z, 10),
    cone(p.r * 1.25, p.r * 1.6, p.x, p.h + 0.4 + p.r * 0.8, p.z, 9),
  ]),
  gable: (p) => gableRoof(p.w, p.d, p.rise, 0, p.y, p.z),
  chimney: (p) => merge([
    box(0.9, p.h, 0.9, p.x, p.h / 2, p.z),
    box(1.15, 0.25, 1.15, p.x, p.h + 0.12, p.z),
  ]),
  hearth: (p) => merge([
    box(2.6, 1.5, 1.1, p.x, 0.75, p.z),
    box(3.0, 0.28, 1.35, p.x, 1.62, p.z),
    box(1.5, 3.4, 1.0, p.x, 3.4, p.z),
  ]),
  furnace: (p) => furnace(p.x, p.z, p.ry ?? 0),
  kiln: (p) => kiln(p.x, p.z),
  bench: (p) => bench(p.x, p.z, p.w ?? 2.2, p.ry ?? 0),
  vessels: (p, r) => vessels(p.x, p.z, r),
  shelving: (p) => {
    const parts = [];
    const n = 4;
    for (let i = 0; i < n; i++) parts.push(box(p.w, 0.08, 0.5, 0, 0.5 + i * (p.h / n), p.z));
    parts.push(box(p.w, p.h, 0.12, 0, p.h / 2, p.z - 0.24));
    return merge(parts);
  },
  pavement: (p) => box(p.w, 0.1, p.d, 0, 0.05, p.z),
  stepped: (p) => stepped(p.base, p.h, p.steps, p.x, p.z),
  obelisk: (p) => obelisk(p.h, p.r, p.x, p.z, p.y ?? 0),
  sarcophagus: (p) => sarcophagus(p.x, p.z, p.ry ?? 0),
  basin: (p) => basin(p.x, p.z, p.r ?? 3.2),
  ringwall: (p) => {
    const parts = [];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const g = box(p.r * 0.24, p.h, 0.4,
                    Math.sin(a) * p.r, p.h / 2, p.z + Math.cos(a) * p.r);
      g.rotateY(0);
      parts.push(g);
    }
    return merge(parts);
  },
  parterre: (p) => {
    const parts = [];
    for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) {
      parts.push(box(p.w / 2 - 0.9, 0.24, p.d / 2 - 0.9, (i * p.w) / 4, 0.12, p.z + (j * p.d) / 4));
    }
    return merge(parts);
  },
  tilled: (p, r) => tilledRows(p.x, p.z, r, p.w, p.d),
  fence: (p) => fence(p.x, p.z, p.len, p.ry ?? 0),
  tree: (p) => tree(0, p.x, p.z, p.h ?? 4.4),
  rocks: (p, r) => rocks(p.x, p.z, r, p.n ?? 5, p.scale ?? 1),
  mound: (p) => {
    const g = new THREE.SphereGeometry(p.r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, p.h / p.r, 0.85);
    g.translate(p.x, -0.2, p.z);
    return g;
  },
  bank: (p) => box(p.w, 0.5, p.d, 0, 0.25, p.z),
  shore: (p) => box(p.w, 0.4, p.d, 0, 0.2, p.z),
  water: (p) => box(p.w, 0.12, p.d, 0, 0.06, p.z),
  pool: (p) => merge([
    box(p.w, 0.16, p.d, 0, 0.08, p.z),
    box(p.w + p.rim * 2, 0.34, p.rim, 0, 0.17, p.z + p.d / 2 + p.rim / 2),
    box(p.w + p.rim * 2, 0.34, p.rim, 0, 0.17, p.z - p.d / 2 - p.rim / 2),
    box(p.rim, 0.34, p.d, -p.w / 2 - p.rim / 2, 0.17, p.z),
    box(p.rim, 0.34, p.d, p.w / 2 + p.rim / 2, 0.17, p.z),
  ]),
};

/**
 * Emit the plan. One merged BufferGeometry per material slot, so a station
 * costs at most four draw calls no matter how many modules it contains.
 * @param {object} plan       from planSetting()
 * @param {object} materials  { stone, timber, green, water } THREE.Material
 * @returns {THREE.Group}
 */
export function compileSetting(plan, materials) {
  const r = rng(plan.seed * 40503 + 7);
  const bySlot = {};
  let tris = 0;

  for (const m of plan.modules) {
    const build = BUILDERS[m.id];
    if (!build) continue;
    let g;
    try {
      g = build(m, r);
    } catch (e) {
      console.warn("[settings] module failed", m.id, e);
      continue;
    }
    if (!g) continue;
    g.deleteAttribute("uv");           // triplanar hatching needs no UVs
    (bySlot[`${m.zone || "back"}|${m.slot}`] ||= []).push(g);
  }

  const group = new THREE.Group();
  group.name = `setting:${plan.archetype}`;
  const back = new THREE.Group(); back.name = "zone:back";
  const flank = new THREE.Group(); flank.name = "zone:flank";
  group.add(back, flank);

  let draws = 0;
  for (const [key, list] of Object.entries(bySlot)) {
    const [zone, slot] = key.split("|");
    const merged = merge(list);
    if (!merged) continue;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, materials[slot] || materials.stone);
    mesh.name = `${plan.archetype}:${zone}:${slot}`;
    (zone === "flank" ? flank : back).add(mesh);
    draws++;
    tris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
    list.forEach((g) => g.dispose());
  }
  group.userData.zones = { back, flank };
  group.userData.diagnostics = { ...plan.diagnostics, triangles: Math.round(tris), drawCalls: draws };
  return group;
}

export const ARCHETYPES = [
  // Atalanta: the settings locations.js reads off Maier's own epigrams
  "courtyard", "temple", "castle", "laboratory", "workshop", "kitchen",
  "library", "cottage", "farm", "garden", "riverside", "bathhouse",
  "seaside", "cave", "hillside",
  // Poliphilo: the precincts his dream walks through
  "forest", "pyramid", "portal", "palace", "doors", "tomb", "fountain",
  "processionway", "shore", "cythera",
];

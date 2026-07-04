import * as THREE from "three";

// ===========================================================================
// papercards.js — build a walkable "tunnel book" for an Atalanta emblem out of
// the REAL figure cutouts already extracted, depth-ordered, and coverage-
// audited in the sibling EmblemPapercraft project (C:\Dev\EmblemPapercraft):
// 51 plates, 96.5% mean ink coverage, gate 51/51. That project renders these
// as a fixed shadow-box you orbit around; this module places the same cards
// at real room-scale 3D depth so you can WALK into the stack — a walk-through
// peepshow / tunnel book, the antique papercraft form this genuinely is.
//
// No synthetic geometry, no primitive props: every figure — person, animal,
// tree, building, cloud — is the actual engraved cutout from the plate, cut
// in place by EmblemPrintShop's CV pipeline, mounted as a flat alpha-tested
// paper card at the depth EmblemPapercraft inferred for it. The full plate
// is the backdrop card at the rear of the tunnel.
// ===========================================================================

const LAYERS_URL = "/EmblemPapercraft/data/layers.json";
const CUTOUT_BASE = "/EmblemPapercraft/images/cutouts/";

let layersPromise = null;
function loadLayers() {
  if (!layersPromise) {
    layersPromise = fetch(LAYERS_URL, { cache: "no-store" })
      .then((r) => r.json())
      .then((list) => {
        const byNum = {};
        list.forEach((e) => { byNum[e.number] = e.layers; });
        return byNum;
      });
  }
  return layersPromise;
}

const texCache = {};
function loadTexture(loader, file) {
  if (texCache[file]) return texCache[file];
  const p = new Promise((resolve) => {
    loader.load(CUTOUT_BASE + file, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    }, undefined, () => resolve(null));
  });
  texCache[file] = p;
  return p;
}

// A gently-curled plane, same trick as EmblemPapercraft's paperCard: real
// paper is never dead flat, so subdividing and bowing the quad along Z gives
// each card a soft highlight and a curved cut-edge shadow.
function curledPlane(w, h, amp, sign) {
  const g = new THREE.PlaneGeometry(w, h, 12, 16);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / w, v = pos.getY(i) / h;
    const bow = amp * Math.cos(u * Math.PI) * (0.6 + 0.4 * Math.cos(v * Math.PI));
    pos.setZ(i, sign * bow);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// Two coplanar layers — a cream paper backing (slightly larger, casts the cut
// shadow) and the engraving itself on top — both alpha-tested to the cutout's
// real silhouette, not its bounding rectangle.
function paperCard(tex, w, h, flat = false) {
  tex.anisotropy = 8;
  const amp = flat ? 0 : Math.min(0.06, Math.max(0.01, 0.025 * h));
  const sign = Math.random() < 0.5 ? -1 : 1;
  const plane = (w2, h2) => (flat ? new THREE.PlaneGeometry(w2, h2) : curledPlane(w2, h2, amp, sign));

  const group = new THREE.Group();
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xefe6cf, alphaMap: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 });
  const paper = new THREE.Mesh(plane(w * 1.03, h * 1.03), paperMat);
  paper.position.z = -0.01; paper.castShadow = true; paper.receiveShadow = true;
  paper.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: tex, alphaTest: 0.5 });
  group.add(paper);

  const inkMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.94 });
  const ink = new THREE.Mesh(plane(w, h), inkMat);
  ink.receiveShadow = true;
  group.add(ink);
  return group;
}

// Room-scale tunnel-book geometry: the backdrop plate hangs at the far wall,
// figures pop forward from it toward the walkable spawn point, positioned by
// their own (cx, cy) picture-plane coordinate and (depth) pop-amount — the
// exact composition Maier's engraver drew, dimensionalized instead of redrawn.
const ROOM_W = 16, ROOM_H = 10;
const BACK_Z = -15, NEAR_Z = -2, SPAWN_Z = 6;
const EYE_BASE = 4.3, EYE_SCALE = 8.6; // maps picture-plane cy -> world Y

// Confirmed by opening the actual PNG — the score-presence heuristic below
// doesn't catch this one because it happens to have no score field despite
// being a bad segmentation (a robed figure's arm + doorway masonry, mislabeled
// "athanor retort"). Add further confirmed-bad files here as they're found;
// this is a spot list, not a substitute for fixing the source extraction.
const KNOWN_BAD = new Set(["emblem-08/athanor_retort.png"]);

export async function buildPapercraftSpace(env, n) {
  const { THREE: T, world, anim } = env;
  const loader = new THREE.TextureLoader();
  const byNum = await loadLayers();
  const layers = byNum[n] || [];
  const backdrop = layers.find((L) => L.role === "backdrop");
  // Cutouts that carry a `score` field are low-confidence automated detections
  // (mean ~0.32, max ~0.58 of 1.0 across the whole set) and some are visibly
  // wrong — e.g. Emblem VIII's "athanor_retort" is actually a mis-segmented
  // crop of a robed figure's arm plus doorway masonry, not the retort. The
  // unscored cutouts (figure/animal/architecture — hand-verified, not scored
  // CV detections) are reliable in every case checked so far. Equipment stays
  // visible on the flat backdrop plate; it just doesn't pop as its own card.
  let figures = layers.filter((L) => L.role !== "backdrop" && L.score === undefined && !KNOWN_BAD.has(L.file));
  // Some plates' extracted elements are ALL scored (equipment-heavy plates
  // especially) — without this they'd pop nothing at all. Let the single
  // highest-scoring cutout through so there's at least one popped figure;
  // one item keeps any mis-segmentation contained and visible rather than
  // compounding across several low-confidence cards.
  if (figures.length === 0) {
    const scored = layers.filter((L) => L.role !== "backdrop" && !KNOWN_BAD.has(L.file));
    if (scored.length) {
      const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
      figures = [best];
    }
  }

  const interactables = [];

  if (backdrop) {
    const tex = await loadTexture(loader, backdrop.file);
    if (tex) {
      const card = paperCard(tex, ROOM_W, ROOM_H, true);
      card.position.set(0, EYE_BASE, BACK_Z);
      world.add(card);
    }
  }

  // load all figure cutouts in parallel, then place them back-to-front so
  // near-page (background) cards don't visually occlude foreground ones
  // during the (near-instant, cached) load
  const loaded = await Promise.all(figures.map(async (L) => ({ L, tex: await loadTexture(loader, L.file) })));
  loaded
    .filter((x) => x.tex)
    .sort((a, b) => a.L.depth - b.L.depth)
    .forEach(({ L, tex }) => {
      const w = Math.max(0.3, L.nw * ROOM_W);
      const h = Math.max(0.3, L.nh * ROOM_H);
      const card = paperCard(tex, w, h, false);
      const x = (L.cx - 0.5) * ROOM_W;
      const y = EYE_BASE + (0.5 - L.cy) * EYE_SCALE;
      const z = BACK_Z + L.depth * (NEAR_Z - BACK_Z);
      card.position.set(x, y, z);
      card.userData.tag = L.label;
      card.userData.category = L.category;
      world.add(card);
      interactables.push(card);
    });

  return {
    spawn: { pos: new T.Vector3(0, 1.7, SPAWN_Z), look: new T.Vector3(0, EYE_BASE * 0.6, BACK_Z) },
    bounds: { minX: -ROOM_W / 2 + 0.6, maxX: ROOM_W / 2 - 0.6, minZ: BACK_Z + 0.8, maxZ: SPAWN_Z - 0.5 },
    interactables,
  };
}

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildArmature, ARMATURES } from "./armatures.js";

// ===========================================================================
// reconstruct.js — Phase 5. Build an emblem's space from its own perspective
// construction instead of from a heuristic depth channel.
//
// The rule the whole module obeys:
//
//     Z = focal_px * eye_height_m / (y_pixels - horizon_y)
//
// That is the plain pinhole relation for a camera of focal length f at height E
// looking horizontally at a flat ground plane. Every depth in the scene comes
// from it and from nothing else. Because the camera is then set to the SAME
// f and E, the assembled 3D scene reprojects onto the source plate exactly —
// which is the reprojection gate (press G), and which is why the gate can be a
// real test rather than a vibe check.
//
// What replaced what:
//   old  depth = cy - CATEGORY_BIAS - 0.15 * area          (no perspective at all)
//   new  depth from the element's GROUND CONTACT through the solved pinhole
//
//   old  card size = nw * ROOM_W, nh * ROOM_H, room aspect hardcoded 16:10
//        against plates of aspect ~1.17, so every scene was stretched ~37%
//   new  card size follows from its pixel size and its own depth, so a card
//        always subtends the angle it subtends in the engraving
//
//   old  backdrop = a destructively holed scan of a whole book page, binding,
//        gutter and letterpress included
//   new  backdrop = the complete Claudiens plate the masks were cut from
// ===========================================================================

const params = new URLSearchParams(location.search);
const KEY = params.get("id") || "emblem-08";

const canvas = document.getElementById("r-canvas");
const els = {
  title: document.getElementById("r-title"),
  badge: document.getElementById("r-badge"),
  loading: document.getElementById("r-loading"),
  readout: document.getElementById("r-readout"),
  pop: document.getElementById("r-pop"),
  gateOverlay: document.getElementById("r-gate-overlay"),
  walkOverlay: document.getElementById("r-walk-overlay"),
};

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------
const [PERSP, ELEMS, MANIFEST] = await Promise.all([
  fetch("data/perspective.json").then((r) => r.json()),
  fetch("data/elements.json").then((r) => r.json()),
  fetch("assets/manifest.json").then((r) => r.json()),
]);

const solve = PERSP[KEY];
const plateInfo = MANIFEST[KEY];
const elements = (ELEMS[KEY] || { elements: [] }).elements;
if (!solve || !plateInfo) throw new Error(`no solve/plate for ${KEY}`);

const W = solve.width, H = solve.height;
const F = solve.focal_px;                       // px
const EYE = solve.eye_height_m || 1.6;          // m
const YH = solve.horizon_y;                     // px

// vertical field of view of a pinhole with this focal length and this plate
const VFOV = 2 * Math.atan(H / (2 * F)) * (180 / Math.PI);

// ---- the two functions the whole reconstruction rests on ----------------
/** Depth in metres of a ground-contact point at image row y. */
const depthAt = (y) => (y <= YH + 1e-6 ? Infinity : (F * EYE) / (y - YH));
/** Lateral position in metres of image column x at depth z. */
const lateralAt = (x, z) => ((x - W / 2) * z) / F;
/** World size in metres of a span of `px` pixels seen at depth z. */
const sizeAt = (px, z) => (px * z) / F;

// ---------------------------------------------------------------------------
// renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// One tone-map owner, declared here and nowhere else. The old scene had an ink
// shader doubling as edge detector, vignette, grain and de-facto tone mapper,
// which is most of why every emblem rendered near-black.
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141109);

const camera = new THREE.PerspectiveCamera(VFOV, 1, 0.05, 4000);
const STATION = new THREE.Vector3(0, EYE, 0);   // the engraver's station point
camera.position.copy(STATION);
camera.lookAt(0, EYE, -10);

const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, EYE * 0.9, -depthAt(H * 0.9));
orbit.enableDamping = true;
orbit.update();

const world = new THREE.Group();
scene.add(world);

// Cards are photographic ink on paper; lighting them would break the
// reprojection gate, so they are unlit by default. `paperLight` swaps in a lit
// material for the papercraft look once you have stopped testing.
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const key = new THREE.DirectionalLight(0xfff3dd, 1.1);
key.position.set(-6, 9, 6);
scene.add(key);

const texLoader = new THREE.TextureLoader();
const loadTex = (url) =>
  new Promise((res) => texLoader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    res(t);
  }, undefined, () => res(null)));

let unlit = true;
const cardMaterial = (tex, transparent) =>
  unlit
    ? new THREE.MeshBasicMaterial({ map: tex, transparent, alphaTest: transparent ? 0.45 : 0, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ map: tex, transparent, alphaTest: transparent ? 0.45 : 0, side: THREE.DoubleSide, roughness: 0.95 });

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------
const ASSET = "assets/";
const BACKDROP_Z = 90;       // m; far enough that it reads as "the rest of the picture"
const cards = [];            // {mesh, z, flatY, flatScale} for the pop slider
const notes = [];

async function build() {
  // ---- backdrop: the complete plate, sized to fill the frame exactly ------
  // At distance d a plane of height 2*d*tan(vfov/2) fills the view. Placing the
  // whole plate there means everything not otherwise reconstructed still reads
  // in its correct position, and there is no void anywhere — the failure that
  // put a black rectangle through the middle of the flagship emblem.
  const plateTex = await loadTex(ASSET + plateInfo.plate);
  if (plateTex) {
    const h = 2 * BACKDROP_Z * Math.tan((VFOV * Math.PI) / 360);
    const w = (h * W) / H;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cardMaterial(plateTex, false));
    back.position.set(0, EYE, -BACKDROP_Z);
    back.renderOrder = -10;
    back.userData.role = "backdrop";
    world.add(back);
  }

  // ---- ground: the plate's own pavement, rectified to a top-down texture --
  if (plateInfo.ground) {
    const g = plateInfo.ground;
    const tex = await loadTex(ASSET + g.file);
    if (tex) {
      const depth = g.z_far_m - g.z_near_m;
      const geo = new THREE.PlaneGeometry(g.x_half_m * 2, depth, 1, 1);
      const mesh = new THREE.Mesh(geo, cardMaterial(tex, false));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0, -(g.z_near_m + depth / 2));
      mesh.userData.role = "ground";
      world.add(mesh);
      notes.push(`ground rectified from the plate: ${g.z_near_m}–${g.z_far_m} m deep, ` +
                 `${(g.x_half_m * 2).toFixed(1)} m wide, ${(g.coverage * 100) | 0}% of it real pixels`);
      // The rectification assumes the ground is FLAT. Where it is not — a bank,
      // a slope, a bed of shrubs — the warp cannot register, and the gate says so
      // by leaving structure below the horizon instead of flat grey. Saying it
      // here as well means the failure is on the page, not only in the test.
      if (g.coverage < 0.6) {
        notes.push(`WARNING — this ground FAILS the reprojection gate below the ` +
                   `horizon. Only ${(g.coverage * 100) | 0}% of the rectified area is ` +
                   `real plate pixels, and the foreground here is not a flat plane ` +
                   `(bank, shrubs, slope), which is what the warp assumes. Treat the ` +
                   `walkable ground as indicative, not reconstructed.`);
      }
    }
  }

  // ---- bespoke armature, where one has been built ------------------------
  const arm = await buildArmature(KEY, {
    THREE, world, solve, plateInfo, depthAt, lateralAt, sizeAt, loadTex, cardMaterial,
  });
  if (arm) notes.push(...arm.notes);

  // ---- elements ----------------------------------------------------------
  const skipped = { ornament: 0, architecture: 0, furniture: 0, lowcontact: 0 };
  for (const e of elements) {
    // Only STANDING things become cards. An ornament (Merian's cloud-scrolls)
    // has no depth to have; architecture is the space, and is either built by
    // an armature or left reading correctly on the backdrop; furniture is not
    // part of the picture at all. Popping any of them is the misclassification
    // that produced free-floating vaults and walk-behind wall diagrams.
    if (e.kind !== "standing") { skipped[e.kind] = (skipped[e.kind] || 0) + 1; continue; }
    if (arm && arm.handled && arm.handled.has(e.file)) continue;
    if (e.contact_confidence < 0.3) { skipped.lowcontact++; continue; }

    const z = depthAt(e.contact_y);
    if (!isFinite(z) || z <= 0.2 || z > 400) { skipped.lowcontact++; continue; }

    const tex = await loadTex(`assets/cutouts/${e.file}`);
    if (!tex) continue;

    const hw = sizeAt(e.bbox[2], z);
    const hh = sizeAt(e.bbox[3], z);
    const x = lateralAt(e.contact_x, z);
    // the card's base sits ON the ground; its top follows from its pixel height
    const baseY = 0;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(hw, hh), cardMaterial(tex, true));
    mesh.position.set(x, baseY + hh / 2, -z);
    mesh.userData = {
      role: "standing", label: e.label, z, height_m: hh,
      contact_confidence: e.contact_confidence, kind_reviewed: !!e.kind_reviewed,
    };
    world.add(mesh);
    cards.push(mesh);
    notes.push(`${e.label}: stands ${z.toFixed(2)} m out, ${hh.toFixed(2)} m tall` +
               (e.contact_confidence < 0.6 ? "  (weak ground contact)" : ""));
  }

  const sk = Object.entries(skipped).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ");
  if (sk) notes.push(`left on the backdrop: ${sk}`);
  return notes;
}

// ---------------------------------------------------------------------------
// the pop slider — how a tunnel book opens
// ---------------------------------------------------------------------------
// At pop=0 every card is pushed back to the backdrop plane and rescaled so it
// subtends exactly the angle it does in the engraving: the scene collapses into
// the flat plate. At pop=1 each card is at its true solved depth. Because the
// scale compensation is applied at every intermediate value, the composition
// stays registered the whole way — the card never grows as it comes toward you.
// The old renderer had no compensation at all, which is why a popped figure read
// as a giant pasted over a small landscape.
// The x offset has to scale with the same factor, so it is recomputed from a
// stored base each time rather than compounded.
const baseX = new WeakMap();
function applyPopStable(t) {
  for (const m of cards) {
    if (!baseX.has(m)) baseX.set(m, m.position.x);
    const z = m.userData.z;
    const zt = z + (1 - t) * (BACKDROP_Z - z);
    const s = zt / z;
    m.scale.setScalar(s);
    m.position.set(baseX.get(m) * s, (m.userData.height_m * s) / 2, -zt);
  }
}

// ---------------------------------------------------------------------------
// walk mode
// ---------------------------------------------------------------------------
const walk = new PointerLockControls(camera, document.body);
const keys = {};
let walking = false;
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyG") toggleGate();
  if (e.code === "KeyL") toggleLight();
});
addEventListener("keyup", (e) => (keys[e.code] = false));

function startWalk() {
  walking = true;
  orbit.enabled = false;
  // spawn at the engraver's own eye height, not a default 1.7 m — for Emblem
  // VIII that is 1.09 m, and standing up straight puts you in a different room
  camera.position.copy(STATION);
  camera.lookAt(0, EYE, -10);
  walk.lock();
  els.walkOverlay.classList.add("hidden");
}
walk.addEventListener("unlock", () => {
  walking = false;
  orbit.enabled = true;
  els.walkOverlay.classList.remove("hidden");
});

// ---------------------------------------------------------------------------
// the reprojection gate
// ---------------------------------------------------------------------------
// Snap the camera back to the station point and lay the source plate over the
// render at 50%. If the reconstruction is right the two are the same picture.
// This is the test the project never had, and it is cheap only because the
// ground truth image has existed since 1617.
// Three states, because "the overlay is invisible" and "the overlay is not
// showing" look identical at 50% opacity. Difference blend removes the
// ambiguity: where the reconstruction registers with the plate the result goes
// black, and any mismatch lights up as an edge.
const GATE_MODES = ["off", "ghost", "difference"];
const GATE_LABEL = {
  ghost: "reprojection gate — source plate at 50% over the render, from the station point",
  difference: "reprojection gate, inverted overlay — FLAT GREY means registered. " +
              "Anything that still shows structure is where the reconstruction disagrees with the engraving.",
};
let gateIdx = 0;
function toggleGate() {
  gateIdx = (gateIdx + 1) % GATE_MODES.length;
  const mode = GATE_MODES[gateIdx];
  const gateOn = mode !== "off";
  els.gateOverlay.classList.toggle("hidden", !gateOn);
  els.gateOverlay.classList.toggle("diff", mode === "difference");
  document.getElementById("r-gate").classList.toggle("on", gateOn);
  if (gateOn) document.querySelector(".gate-label").textContent = GATE_LABEL[mode];
  if (gateOn) {
    if (walking) walk.unlock();
    // identity orientation already looks down -Z, which is where the scene was
    // built; rotating further points the camera out of the picture
    camera.position.copy(STATION);
    camera.quaternion.identity();
    camera.fov = VFOV;
    camera.updateProjectionMatrix();
    orbit.target.set(0, EYE, -50);
    orbit.enabled = false;
    els.pop.value = "1";
    applyPopStable(1);
  } else {
    orbit.enabled = !walking;
  }
}

function toggleLight() {
  unlit = !unlit;
  world.traverse((o) => {
    if (!o.isMesh) return;
    const old = o.material;
    const transparent = old.transparent;
    o.material = cardMaterial(old.map, transparent);
    old.dispose();
  });
}

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const vel = new THREE.Vector3();

function resize() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  // The camera's vertical FOV is fixed by the solve; the canvas aspect only
  // decides how much to the sides you see. Never restretch to fit the canvas —
  // that was the 37% anamorphic distortion in the old renderer.
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  if (walking) {
    const sp = (keys.ShiftLeft ? 3.2 : 1.4) * dt;
    vel.set(0, 0, 0);
    if (keys.KeyW) vel.z += 1;
    if (keys.KeyS) vel.z -= 1;
    if (keys.KeyA) vel.x -= 1;
    if (keys.KeyD) vel.x += 1;
    if (vel.lengthSq()) {
      vel.normalize().multiplyScalar(sp);
      walk.moveForward(vel.z);
      walk.moveRight(vel.x);
    }
    if (keys.KeyQ) camera.position.y = Math.max(0.3, camera.position.y - 1.2 * dt);
    if (keys.KeyE) camera.position.y = Math.min(6, camera.position.y + 1.2 * dt);
  } else if (orbit.enabled) {
    orbit.update();
  }
  els.readout.textContent =
    `station ${EYE.toFixed(2)} m · eye now ${camera.position.y.toFixed(2)} m · ` +
    `${camera.position.z < 0 ? (-camera.position.z).toFixed(1) + " m into the scene" : "at the picture plane"}`;
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// go
// ---------------------------------------------------------------------------
els.title.textContent = `${KEY} — ${solve.type}`;
els.badge.textContent = solve.reviewed ? "hand-reviewed solve" : `auto solve · confidence ${solve.confidence}`;
els.badge.className = solve.reviewed ? "badge good" : "badge weak";

const built = await build();
els.loading.style.display = "none";
document.getElementById("r-notes").innerHTML =
  built.map((n) => `<li>${n}</li>`).join("") +
  `<li class="meta">horizon ny ${solve.horizon_ny} · f ${F} px ` +
  `(${String(solve.focal_basis || "").startsWith("ASSUMED") ? "assumed" : "measured"}) · ` +
  `station eye ${EYE} m · vfov ${VFOV.toFixed(1)}°</li>`;
document.getElementById("r-gate-plate").src = ASSET + plateInfo.plate;

els.pop.addEventListener("input", () => applyPopStable(parseFloat(els.pop.value)));
document.getElementById("r-walk").onclick = startWalk;
document.getElementById("r-gate").onclick = toggleGate;
document.getElementById("r-light").onclick = toggleLight;

applyPopStable(1);
resize();
tick();

export { ARMATURES };

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===========================================================================
// relief-lab.js — the A/B that makes the argument.
//
// The gallery's 213 "carved relief" models drive a displacement map from the
// plate's LUMINANCE: light paper stands proud, dark ink is incised. That is
// semantically inverted. Ink density in an engraving is TONE, and tone is
// shading. The darkest part of a drawn sphere is its shadowed side, not a
// groove; the darkest part of Emblem VIII is the inside of the vault, which is
// the furthest thing away.
//
// This page renders both surfaces under the SAME light so the difference is
// visible rather than argued. Sweep the raking light across and the luminance
// relief shimmers like corrugated ink, while the hatching relief turns like a
// body. That is the whole claim, and it is checkable in about four seconds.
//
// The hatching surface is built offline by tools/hatching_relief.py:
//   structure tensor -> stroke direction -> across-stroke height gradient,
//   signed and scaled by local stroke density -> Frankot-Chellappa integration.
// ===========================================================================

const canvas = document.getElementById("rl-canvas");
const els = {
  plate: document.getElementById("rl-plate"),
  depth: document.getElementById("rl-depth"),
  sweep: document.getElementById("rl-sweep"),
  badge: document.getElementById("rl-badge"),
  readout: document.getElementById("rl-readout"),
  explain: document.getElementById("rl-explain"),
  stats: document.getElementById("rl-stats"),
  maps: document.getElementById("rl-maps"),
  loading: document.getElementById("rl-loading"),
};

const MANIFEST = await fetch("assets/relief/manifest.json").then((r) => r.json());
const KEYS = Object.keys(MANIFEST).sort();

const ROMAN = { "emblem-00": "Frontispiece", "emblem-01": "I", "emblem-05": "V",
                "emblem-08": "VIII", "emblem-21": "XXI", "emblem-45": "XLV" };
const label = (k) => `Emblem ${ROMAN[k] || k.replace("emblem-", "")}`;

const EXPLAIN = {
  hatching: `<b>Shape from hatching.</b> The burin follows the form, so the
    <i>direction</i> of a stroke is evidence about which way the surface turns, and the
    <i>density</i> of strokes is tone. A structure tensor recovers the stroke field;
    the height gradient is taken across the strokes, signed by which way the tone is
    increasing; that field is integrated to a surface. Nothing here is driven by
    brightness alone.`,
  luminance: `<b>Displacement from luminance</b> — the method the gallery's 213 models
    use today. Dark pixels are pushed in, light pixels stand proud. It produces a
    relief of the <i>plate</i> rather than of the thing depicted: every shadow becomes
    a trench and every highlight a ridge, so a sphere and a flat wall get the same
    corrugated-ink surface.`,
};

// ---------------------------------------------------------------------------
// renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141109);

const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
camera.position.set(0, 0, 7.2);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.minDistance = 3.2;
controls.maxDistance = 14;

// A raking light is the instrument. Almost flat to the surface, so a millimetre
// of relief throws a centimetre of shadow and the recovered form is legible.
const rake = new THREE.DirectionalLight(0xfff1d8, 3.1);
rake.position.set(-5, 2.4, 2.2);
scene.add(rake);
scene.add(new THREE.AmbientLight(0x6a6250, 0.55));
const fill = new THREE.DirectionalLight(0x9fb4d0, 0.35);
fill.position.set(4, -2, 3);
scene.add(fill);

const loader = new THREE.TextureLoader();
const cache = new Map();
function tex(url, srgb) {
  const k = url + (srgb ? "|s" : "");
  if (!cache.has(k)) {
    cache.set(k, new Promise((res) => loader.load("assets/" + url, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      res(t);
    }, undefined, () => res(null))));
  }
  return cache.get(k);
}

// ---------------------------------------------------------------------------
// the slab
// ---------------------------------------------------------------------------
let mesh = null;
let state = { key: KEYS.includes("emblem-01") ? "emblem-01" : KEYS[0],
              method: "hatching", surface: "ink" };

// Two clicks in quick succession start two builds; whichever finishes last wins,
// and it may not be the one the user asked for. Same guard as scene.js uses for
// its cutout loads.
let buildId = 0;

async function build() {
  const mine = ++buildId;
  els.loading.style.display = "";
  const rec = MANIFEST[state.key];
  const aspect = rec.w / rec.h;
  const H = 4.0, W = H * aspect;

  const [height, normal, plate] = await Promise.all([
    tex(state.method === "hatching" ? rec.height : rec.luminance, false),
    tex(state.method === "hatching" ? rec.normal : rec.luminance_normal, false),
    tex(`plates/${state.key}.jpg`, true),
  ]);

  if (mine !== buildId) return;                       // superseded mid-load
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }

  // Dense enough that the displacement has somewhere to go. This is the honest
  // cost of vertex displacement — the parallax-occlusion approach in the Phase 6
  // proposal would do it in the fragment shader instead.
  const seg = 620;
  const geo = new THREE.PlaneGeometry(W, H, Math.round(seg * aspect), seg);

  const mat = new THREE.MeshStandardMaterial({
    map: state.surface === "ink" ? plate : null,
    color: state.surface === "ink" ? 0xffffff : 0xe8dcc2,
    displacementMap: height,
    displacementScale: parseFloat(els.depth.value) * 0.55,
    displacementBias: -parseFloat(els.depth.value) * 0.27,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.93,
    metalness: 0.0,
  });
  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  els.badge.textContent = state.method === "hatching"
    ? `stroke-driven over ${(rec.stroke_driven_fraction * 100) | 0}% of the surface`
    : "the current gallery method";
  els.badge.className = "badge " + (state.method === "hatching" ? "good" : "weak");
  els.explain.innerHTML = EXPLAIN[state.method];
  els.stats.innerHTML =
    `<code>${rec.w}×${rec.h}</code> · coherent stroke field over
     <code>${(rec.coherent_fraction * 100) | 0}%</code> of the plate ·
     the remainder falls back to shape-from-shading, which is the honest behaviour
     where there is no stroke direction to read (open paper, stipple, cross-hatch).`;

  els.maps.innerHTML = [
    ["flow", "the recovered stroke field", rec.flow],
    ["tone", "stroke density as tone", rec.tone],
    ["height", "integrated height", rec.height],
  ].map(([k, cap, f]) =>
    `<figure><img src="assets/${f}" alt="${cap}" loading="lazy" /><figcaption>${cap}</figcaption></figure>`
  ).join("");

  els.loading.style.display = "none";
}

// ---------------------------------------------------------------------------
// controls
// ---------------------------------------------------------------------------
for (const k of KEYS) {
  const o = document.createElement("option");
  o.value = k; o.textContent = label(k);
  if (k === state.key) o.selected = true;
  els.plate.append(o);
}
els.plate.onchange = () => { state.key = els.plate.value; build(); };

function seg(id, attr, key) {
  const box = document.getElementById(id);
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    [...box.querySelectorAll("button")].forEach((x) => x.classList.toggle("on", x === b));
    state[key] = b.dataset[attr];
    build();
  });
}
seg("rl-method", "m", "method");
seg("rl-surface", "s", "surface");

els.depth.addEventListener("input", () => {
  if (!mesh) return;
  const d = parseFloat(els.depth.value);
  mesh.material.displacementScale = d * 0.55;
  mesh.material.displacementBias = -d * 0.27;
});

// Dragging the canvas moves the light, not the camera. The light is the
// instrument here; the camera is not.
let dragging = false, azim = 2.6, elev = 0.42;
canvas.addEventListener("pointerdown", (e) => { if (e.button === 0) dragging = true; });
addEventListener("pointerup", () => (dragging = false));
addEventListener("pointermove", (e) => {
  if (!dragging) return;
  sweeping = false; els.sweep.classList.remove("on");
  azim -= e.movementX * 0.006;
  elev = Math.max(0.06, Math.min(1.35, elev - e.movementY * 0.005));
});

let sweeping = true;
els.sweep.onclick = () => {
  sweeping = !sweeping;
  els.sweep.classList.toggle("on", sweeping);
};

// ---------------------------------------------------------------------------
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime();
  if (sweeping) azim = 2.2 + Math.sin(t * 0.42) * 1.5;
  const r = 6.5;
  rake.position.set(Math.cos(azim) * r * Math.cos(elev),
                    Math.sin(elev) * r,
                    Math.sin(azim) * r * Math.cos(elev) + 2.2);
  els.readout.textContent =
    `light  azimuth ${((azim * 180 / Math.PI) % 360).toFixed(0)}°  ` +
    `elevation ${(elev * 180 / Math.PI).toFixed(0)}°  ·  ` +
    `relief ×${parseFloat(els.depth.value).toFixed(2)}`;
  controls.update();
  renderer.render(scene, camera);
}

await build();
resize();
tick();

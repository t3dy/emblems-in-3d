import * as THREE from "three";
import { loadTam, makeHatchMaterial, HatchRegistry } from "./hatch.js";
import { Course } from "./course.js";
import { Station } from "./station.js";
import { CameraDirector, WORLD_FOV, WALK_EYE } from "./camera.js";
import { stationHTML, stationLabel } from "./narration.js";
import { ChipPlayer } from "./vendor/chiptune.js";
import { GAME_PALETTES } from "./vendor/gamesynths.js";

// ===========================================================================
// main.js — The Fugitive World.
//
// One walkable course, fifty-one stations, in the order Maier printed them.
// Free walking and a guided tour share ONE camera; inside a solved station the
// camera adopts that plate's own focal length and eye height, so the
// reprojection gate — press G — still works from inside the world.
//
// See DECISIONS.md §Phase 7 for why the world is a race course rather than a
// gallery, why 46 of the 51 stations are flats rather than rooms, and why the
// stage colour is a gradient rather than four districts.
// ===========================================================================

const STREAM_KEEP = 5;          // stations whose plates stay resident
const DWELL_S = 16;

const $ = (id) => document.getElementById(id);
const els = {
  canvas: $("w-canvas"), hud: $("w-hud"), title: $("w-title"), sub: $("w-sub"),
  panel: $("w-panel"), body: $("w-body"), loading: $("w-loading"),
  gate: $("w-gate"), gateImg: $("w-gate-img"), gateLabel: $("w-gate-label"),
  prompt: $("w-prompt"), debug: $("w-debug"), tourbar: $("w-tourbar"),
  tourPos: $("w-tourpos"), progress: $("w-progress"),
  routeGloss: $("w-routegloss"), sound: $("w-sound"),
};

// ---------------------------------------------------------------------------
const world = await fetch("data/world.json").then((r) => r.json());

const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(WORLD_FOV, innerWidth / innerHeight, 0.08, 2000);

// --- the one material family ------------------------------------------------
const tam = loadTam("../assets/hatch/tam.png");
const hatch = new HatchRegistry();
const materials = {
  stone: hatch.add(makeHatchMaterial({ tam, scale: 0.55, contrast: 1.18, ambient: 0.52 })),
  timber: hatch.add(makeHatchMaterial({ tam, scale: 0.95, contrast: 1.4, ambient: 0.34, paper: 0xe4d9bf })),
  green: hatch.add(makeHatchMaterial({ tam, scale: 0.22, contrast: 1.05, ambient: 0.62, paper: 0xf2ecdb })),
  water: hatch.add(makeHatchMaterial({ tam, scale: 0.5, contrast: 0.7, ambient: 0.55, flat: 1, flatTone: 0.34, paper: 0xe9e6dc })),
  // The course itself is hatched at a fixed mid tone rather than shaded, the
  // way an engraver lays a road in: it must read as a track from a distance.
  road: hatch.add(makeHatchMaterial({ tam, scale: 0.7, contrast: 1, ambient: 0.5, flat: 1, flatTone: 0.62, paper: 0xded2b6 })),
};

// --- the course --------------------------------------------------------------
const course = new Course(world, materials);
scene.add(course.group);

// a shared soft contact patch, so built masses sit on the ground instead of
// hovering. There are no shadow maps in this world: an engraving shades with
// hatching, not with a cast shadow, and the hatch material owns its own tone.
const contactTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grd.addColorStop(0, "rgba(40,34,26,0.42)");
  grd.addColorStop(0.6, "rgba(40,34,26,0.16)");
  grd.addColorStop(1, "rgba(40,34,26,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const contactMat = new THREE.MeshBasicMaterial({
  map: contactTex, transparent: true, depthWrite: false,
});

// --- the stations -------------------------------------------------------------
const ctx = { materials, assetBase: "../assets" };
const stations = world.route.map((key) => {
  const s = new Station(world.stations[key], ctx);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), contactMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(0, 0.012, -6);
  patch.renderOrder = 1;
  s.group.add(patch);
  scene.add(s.group);
  return s;
});

// --- camera ------------------------------------------------------------------
const dir = new CameraDirector(camera, els.canvas);
dir.bounds = course.bounds;
dir.setOwner("world");

// Deep links. ?station=8 puts you on the road outside Emblem VIII; &tour=1
// starts the guided tour there. Useful for citing a particular station in
// writing, and for the fixed-view checks in docs/WORLD.md.
const qs = new URLSearchParams(location.search);
const startAt = Math.max(0, Math.min(50, parseInt(qs.get("station") ?? "0", 10) || 0));
{
  const p0 = course.stops[startAt];
  const ahead = course.stops[Math.min(50, startAt + 1)];
  camera.position.set(p0.x, WALK_EYE, p0.z + 9);
  camera.lookAt(ahead.x, WALK_EYE, ahead.z - 2);
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
  dir.yaw = e.y; dir.pitch = e.x;
}

// --- tour --------------------------------------------------------------------
function tourStops() {
  return routeOrder().map((i) => {
    const s = stations[i];
    const { pos, look } = s.viewPose();
    const fov = s.plateFov();
    return {
      key: s.st.key,
      n: s.st.n,
      index: i,
      view: {
        pos, look,
        fov: fov ?? WORLD_FOV,
        eye: s.eye,
        owner: fov ? `plate:${String(s.st.n).padStart(2, "0")}` : "world",
      },
      dwell: DWELL_S,
    };
  });
}

// --- routes -------------------------------------------------------------------
// The road is laid out in emblem order because that is the book. A route does
// not move a station; it chooses the order the tour visits them, so "the order
// of the work" is a genuinely different reading of the same terrain rather
// than a second copy of it. Free explore is the absence of a tour.
const indexOf = Object.fromEntries(world.route.map((k, i) => [k, i]));
let routeId = "emblem";

function routeOrder() {
  const r = world.routes?.[routeId];
  if (!r) return world.route.map((_, i) => i);
  return r.stations.map((k) => indexOf[k]).filter((i) => i != null);
}

function setRoute(id) {
  routeId = id;
  for (const b of ["emblem", "process", "free"]) {
    $(`w-route-${b}`).classList.toggle("on", b === id);
    $(`w-route-${b}`).classList.toggle("ghost", b !== id);
  }
  if (id === "free") {
    els.routeGloss.textContent =
      "Walk where you like. The stations stay where the book put them; the panel " +
      "follows whichever one you are standing in.";
    if (dir.tour) dir.stopTour();
    return;
  }
  const r = world.routes[id];
  els.routeGloss.textContent = r.gloss;
  if (dir.tour) startTour(0);      // re-enter the tour under the new order
}

// --- the fugues ----------------------------------------------------------------
// Atalanta Fugiens is fifty three-voice canons as much as it is fifty
// engravings — "emblems for the eyes, fugues for the ears, epigrams for the
// intellect". chiptune.js renders each canon through an NES-APU-style synth
// (two pulse channels plus a triangle bass, one per voice, which is what the
// three tonal NES channels are for). Off until asked: a page that starts
// making noise unbidden is a page people close.
const chip = new ChipPlayer();
let chipReady = false, soundOn = false, soundedFor = -1;

async function ensureChip() {
  if (chipReady) return;
  await chip.load("../assets/audio/fugues.json");
  chipReady = true;
}

function setSound(on) {
  soundOn = on;
  els.sound.textContent = on ? "Fugues: on" : "Fugues: off";
  els.sound.classList.toggle("on", on);
  els.sound.classList.toggle("ghost", !on);
  if (!on) { chip.stop(); soundedFor = -1; return; }
  ensureChip().then(() => playFugueFor(current));
}

/** Emblem N's own canon. The title page has none — it is not one of the fifty. */
function playFugueFor(i) {
  if (!soundOn || !chipReady || i < 0) return;
  const n = stations[i].st.n;
  if (n === soundedFor) return;
  soundedFor = n;
  chip.stop();
  if (n < 1) return;
  chip.playEmblem(n, {
    loop: true,
    palettes: GAME_PALETTES,
    startPalette: n % GAME_PALETTES.length,
  });
}

let current = -1;
function showStation(i, { openPanel = false } = {}) {
  if (i === current) return;
  current = i;
  const st = stations[i].st;
  els.title.textContent = st.roman ? `Emblema ${st.roman}` : "Title page";
  els.sub.textContent = stationLabel(st).replace(/^[^·]*·\s*/, "");
  els.body.innerHTML = stationHTML(st);
  els.gateImg.src = `../assets/${st.plate.file}`;
  els.progress.style.width = `${((i + 1) / stations.length) * 100}%`;
  if (openPanel) setPanel(true);
  stream(i);
  playFugueFor(i);
}

/** One place that knows whether the panel is open, so the HUD can stay centred
 *  on what you can actually see rather than on the window. */
function setPanel(open) {
  els.panel.classList.toggle("hidden", !open);
  document.body.classList.toggle("panel-open", open);
}

function stream(centre) {
  for (let i = 0; i < stations.length; i++) {
    const near = Math.abs(i - centre) <= STREAM_KEEP;
    if (near) stations[i].load();
    else stations[i].unload();
  }
}

/** Which station the walker is actually standing in, by metres rather than by
 *  route index: the road swings, so a station two numbers away can be nearer
 *  than its neighbour. */
function syncNearest() {
  if (dir.tour) return current;
  const { index, distance } = course.nearest(camera.position);
  if (distance < 34) showStation(index);
  return current;
}

/** Visibility is a separate, cheaper pass than streaming: it runs on actual
 *  metres rather than on route index, because the road swings and a station
 *  two numbers away can be closer than its neighbour. */
function updateVisibility() {
  for (const s of stations) s.setViewerDistance(s.group.position.distanceTo(camera.position));
}

dir.onTourEvent = (e) => {
  if (e.type === "arrive") {
    showStation(e.stop.index, { openPanel: true });
    els.tourPos.textContent = `${e.index + 1} / ${e.total}`;
    els.hud.classList.add("touring");
  } else if (e.type === "tour-end" || e.type === "tour-complete") {
    els.tourbar.classList.add("hidden");
    els.hud.classList.remove("touring");
    els.prompt.classList.remove("hidden");
  } else if (e.type === "lock") {
    els.prompt.classList.toggle("hidden", e.locked || !!dir.tour);
  }
};

function startTour(from = 0) {
  els.tourbar.classList.remove("hidden");
  setPanel(true);
  els.prompt.classList.add("hidden");
  dir.startTour(tourStops(), course.curve, from);
}

// --- the gate ----------------------------------------------------------------
let gateState = 0;     // 0 off · 1 plate over render · 2 plate only
function setGate(s) {
  syncNearest();          // the gate must speak for the station you are in
  gateState = s % 3;
  els.gate.classList.toggle("hidden", gateState === 0);
  els.gateImg.style.opacity = gateState === 1 ? "0.5" : "1";
  const st = stations[Math.max(0, current)]?.st;
  const ok = st && st.plate.horizon_recoverable;
  els.gateLabel.textContent = ok
    ? "reprojection gate — the source plate over the render, from the station point. If the reconstruction is right, these are one picture."
    : "this plate has no recoverable horizon, so there is nothing to reproject: the gate is not a test here, only a comparison.";
}

/** Stand exactly where the plate was drawn from, and take that plate's lens. */
function takeStationPoint(i) {
  const s = stations[i];
  const { pos, look } = s.viewPose();
  const fov = s.plateFov();
  const m = new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0));
  dir.handoff({
    position: pos,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(m),
    fov: fov ?? WORLD_FOV,
    owner: fov ? `plate:${String(s.st.n).padStart(2, "0")}` : "world",
    eye: s.eye,
  }, 1.1);
  showStation(i, { openPanel: true });
}

// --- input -------------------------------------------------------------------
els.canvas.addEventListener("click", () => {
  if (dir.mode === "tour") return;
  dir.requestLock();
});

let popT = 1;
addEventListener("keydown", (e) => {
  switch (e.code) {
    case "KeyG": setGate(gateState + 1); break;
    case "KeyF": if (current >= 0) takeStationPoint(current); break;
    case "KeyT":
      if (dir.tour) dir.stopTour(); else startTour();
      break;
    case "KeyP": setPanel(els.panel.classList.contains("hidden")); break;
    case "KeyM": setSound(!soundOn); break;
    case "Backquote": els.debug.classList.toggle("hidden"); break;
    case "KeyH": hatch._dbg = !hatch._dbg; hatch.setDebugTone(hatch._dbg); break;
    case "BracketLeft": popT = Math.max(0, popT - 0.2); applyPop(); break;
    case "BracketRight": popT = Math.min(1, popT + 0.2); applyPop(); break;
    case "Space":
      if (dir.tour) { dir.tour.paused = !dir.tour.paused; e.preventDefault(); }
      break;
    case "PageDown": dir.tour ? dir.tourNext() : null; break;
    case "PageUp": dir.tour ? dir.tourPrev() : null; break;
    case "Escape": if (dir.tour) dir.stopTour(); break;
  }
});
function applyPop() { stations.forEach((s) => s.setPop(popT)); }

$("w-tour-start").onclick = () => startTour(0);
$("w-tour-here").onclick = () => {
  const order = routeOrder();
  const at = Math.max(0, order.indexOf(Math.max(0, current)));
  startTour(at);
};
$("w-route-emblem").onclick = () => setRoute("emblem");
$("w-route-process").onclick = () => setRoute("process");
$("w-route-free").onclick = () => setRoute("free");
$("w-sound").onclick = () => setSound(!soundOn);
$("w-tour-next").onclick = () => dir.tourNext();
$("w-tour-prev").onclick = () => dir.tourPrev();
$("w-tour-stop").onclick = () => dir.stopTour();
$("w-panel-close").onclick = () => setPanel(false);
$("w-read").onclick = () => setPanel(els.panel.classList.contains("hidden"));

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- frame -------------------------------------------------------------------
const clock = new THREE.Clock();
const tint = new THREE.Color();
const sky = new THREE.Color();
let acc = 0;

function frame() {
  const dt = clock.getDelta();
  dir.update(dt);

  // stage gradient: ground tint, sky and fog all follow the walker's z
  course.tintAt(camera.position.z, tint);
  course.skyAt(camera.position.z, sky);
  hatch.setTint(tint);
  hatch.setFog(sky, 60, 430);
  course.skyMat.color.copy(sky).multiplyScalar(1.06);
  course.sky.position.set(camera.position.x, 0, camera.position.z);

  // streaming and the "you are here" readout, twice a second
  acc += dt;
  if (acc > 0.45 && dir.mode !== "handoff") {
    acc = 0;
    updateVisibility();
    syncNearest();
    if (!els.debug.classList.contains("hidden")) {
      const d = dir.debug();
      const s = stations[Math.max(0, current)];
      els.debug.textContent =
        `mode ${d.mode} · owner ${d.owner} · fov ${d.fov}° · eye ${d.eye} m\n` +
        `pos ${d.pos.join(", ")}\n` +
        `stage ${course.stageAt(camera.position.z)} · station ${current + 1}/51 · tier ${s?.tier}\n` +
        `setting ${s?.st.setting} · modules ${s?.diagnostics?.moduleCount} · tris ${s?.diagnostics?.triangles} · draws ${s?.diagnostics?.drawCalls}\n` +
        `loaded plates ${stations.filter((x) => x.loaded).length} · calls ${renderer.info.render.calls} · tris ${renderer.info.render.triangles}\n` +
        `handoff ${d.handoff ?? "—"} · tour ${d.tour ? JSON.stringify(d.tour) : "—"}`;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

els.loading.classList.add("hidden");
setRoute(qs.get("route") === "process" ? "process" : "emblem");
showStation(startAt);
updateVisibility();
frame();
if (qs.get("tour") === "1") startTour(Math.max(0, routeOrder().indexOf(startAt)));
if (qs.get("sound") === "1") setSound(true);

// A small, honest console banner: this is a research artefact, not a game.
console.log(
  `%cThe Fugitive World%c\n${world.route.length} stations · ` +
  `${world.tier_counts.measured} solved, ${world.tier_counts.conjectural} with no recoverable horizon\n` +
  `world.json generated ${world.generated} by ${world.generator}`,
  "font:600 15px Georgia,serif", "font:12px monospace"
);
window.__world = { world, stations, course, dir, hatch, renderer, scene, camera, chip,
  get route() { return routeId; }, setRoute, setSound };

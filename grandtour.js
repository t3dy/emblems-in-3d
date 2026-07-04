import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CATALOG } from "./catalog.js";
import { EMBLEMDATA } from "./emblemdata.js";
import { buildRelief, loadPlate } from "./relief.js";
import { ChipPlayer } from "./chiptune.js";

// ===========================================================================
// grandtour.js — "The Great Work": an on-rails cinematic flight through the
// Atalanta emblems in alchemical order (nigredo→albedo→citrinitas→rubedo),
// each a glowing carved relief, with bloom, drifting embers, per-stage colour
// grading, title cards, and a live-synthesised three-voice canon (the fuga).
// ===========================================================================

const STAGE_ORDER = ["NIGREDO", "ALBEDO", "CITRINITAS", "RUBEDO"];
const STAGE_SUB = {
  NIGREDO: "THE BLACKENING · putrefaction & death",
  ALBEDO: "THE WHITENING · washing & the white swan",
  CITRINITAS: "THE YELLOWING · the dawning gold",
  RUBEDO: "THE REDDENING · the red king & the Stone",
};
const FX = {
  NIGREDO:    { bg: 0x07070b, key: 0x6878a0, kI: 0.7, amb: 0x191b26, ember: 0x7a3b1e, bloom: 0.55, grade: "rgba(20,30,70,0.5)" },
  ALBEDO:     { bg: 0x23272e, key: 0xeef2ff, kI: 1.3, amb: 0x3a414c, ember: 0xc9d4e4, bloom: 0.8,  grade: "rgba(200,220,255,0.4)" },
  CITRINITAS: { bg: 0x241c09, key: 0xffd86a, kI: 1.15, amb: 0x39300f, ember: 0xffcf5a, bloom: 0.95, grade: "rgba(255,200,90,0.45)" },
  RUBEDO:     { bg: 0x1d0a07, key: 0xff7a44, kI: 1.25, amb: 0x33150f, ember: 0xff5436, bloom: 1.3,  grade: "rgba(220,60,30,0.5)" },
};
const PER_STAGE = 4; // hero stations per stage

// ---- pick the hero stations ----
const byStage = {};
for (const e of CATALOG.atalanta) {
  if (e.n === 0) continue;
  const d = EMBLEMDATA[String(e.n)];
  const st = (d && d.stage) || "RUBEDO";
  (byStage[st] ||= []).push({ ...e, data: d });
}
const stations = [];
for (const st of STAGE_ORDER) (byStage[st] || []).slice(0, PER_STAGE).forEach((s) => stations.push({ ...s, stage: st }));

// ---- renderer / scene / camera ----
const canvas = document.getElementById("gt-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(FX.NIGREDO.bg);
scene.fog = new THREE.FogExp2(FX.NIGREDO.bg, 0.018);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
camera.position.set(0, 2, 12);

const amb = new THREE.HemisphereLight(0x8090b0, 0x101018, 0.8); scene.add(amb);
const key = new THREE.PointLight(0xffffff, 1.0, 60, 2); scene.add(key);
const fillSun = new THREE.DirectionalLight(0xffffff, 0.4); fillSun.position.set(-5, 8, 6); scene.add(fillSun);

// ---- composer (bloom) ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h || 1; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

// ---- station placement ----
function stationPos(i) {
  return new THREE.Vector3((i % 2 ? 4.6 : -4.6), 1.6 + ((i % 3) - 1) * 0.8, -i * 15);
}
const stoneGroup = new THREE.Group(); // the final glowing stone
scene.add(stoneGroup);

async function buildStations() {
  const loadingEl = document.getElementById("gt-loading");
  let done = 0;
  await Promise.all(stations.map(async (s, i) => {
    try {
      const { tex, aspect } = await loadPlate(s.img);
      const g = buildRelief(tex, aspect, { depth: 0.5, seg: 130, width: 4.6 });
      g.position.copy(stationPos(i));
      g.lookAt(g.position.x * 0.4, g.position.y + 0.6, g.position.z + 9); // face the rail
      // make the engraving self-luminous so it reads in the void and feeds bloom
      const m = g.userData.mat;
      if (m) { m.emissive = new THREE.Color(0xfff2dc); m.emissiveMap = m.map; m.emissiveIntensity = 0.6; m.needsUpdate = true; }
      scene.add(g);
      s.group = g;
    } catch (e) { /* skip a missing plate */ }
    loadingEl.textContent = `kindling the work… ${++done}/${stations.length}`;
  }));

  // the philosopher's stone at the finale
  const last = stationPos(stations.length - 1);
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0),
    new THREE.MeshStandardMaterial({ color: 0xff5436, emissive: 0xff3018, emissiveIntensity: 2.2, metalness: 0.3, roughness: 0.3 }));
  stone.position.set(last.x < 0 ? last.x + 9.2 : last.x - 9.2, last.y, last.z - 4);
  stoneGroup.add(stone);
  const sl = new THREE.PointLight(0xff5436, 0, 24, 2); sl.position.copy(stone.position); stoneGroup.add(sl);
  stoneGroup.userData = { stone, light: sl };
}

// ---- drifting embers ----
const EMBN = 600;
const emberGeo = new THREE.BufferGeometry();
const epos = new Float32Array(EMBN * 3);
for (let i = 0; i < EMBN; i++) {
  epos[i * 3] = (Math.sin(i * 12.9898) * 43758.5) % 1 * 40 - 20;
  epos[i * 3 + 1] = ((Math.sin(i * 78.233) * 43758.5) % 1) * 18;
  epos[i * 3 + 2] = -((i / EMBN) * stations.length * 15) - 4;
}
emberGeo.setAttribute("position", new THREE.BufferAttribute(epos, 3));
const emberMat = new THREE.PointsMaterial({ color: 0x7a3b1e, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
const embers = new THREE.Points(emberGeo, emberMat); scene.add(embers);

// ---- DOM ----
const card = document.getElementById("gt-card");
const cardRoman = card.querySelector(".gt-roman");
const cardMotto = card.querySelector(".gt-motto");
const stageEl = document.getElementById("gt-stage");
const stageName = stageEl.querySelector(".gt-stage-name");
const stageSub = stageEl.querySelector(".gt-stage-sub");
const grade = document.getElementById("gt-grade");
const progress = document.getElementById("gt-progress");

// ---- timeline state ----
const SEG = 5.2;      // seconds per station
let running = false, paused = false, startT = 0, pausedAt = 0;
let shownIdx = -1, shownStage = null, stageTimer = 0;
const cur = { bg: new THREE.Color(FX.NIGREDO.bg), amb: new THREE.Color(FX.NIGREDO.amb), key: new THREE.Color(FX.NIGREDO.key), ember: new THREE.Color(FX.NIGREDO.ember), kI: FX.NIGREDO.kI, bloom: FX.NIGREDO.bloom };

function framing(i) {
  const p = stationPos(i);
  return { pos: new THREE.Vector3(p.x * 0.35, p.y + 0.8, p.z + 9), look: new THREE.Vector3(p.x, p.y, p.z) };
}
const easeIO = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function showCard(i) {
  const s = stations[i];
  cardRoman.textContent = `EMBLEM ${s.data ? s.data.roman : s.n}`;
  cardMotto.textContent = s.data ? s.data.mottoEn : s.title;
  card.classList.add("show");
}
function showStage(st) {
  stageName.textContent = st.charAt(0) + st.slice(1).toLowerCase();
  stageSub.textContent = STAGE_SUB[st] || "";
  stageEl.classList.add("show"); stageTimer = 2.6;
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const tt = clock.elapsedTime;

  if (running && !paused) {
    const t = (performance.now() - startT) / 1000;
    const N = stations.length;
    const idxF = t / SEG;
    const i = Math.min(Math.floor(idxF), N - 1);
    const j = Math.min(i + 1, N - 1);
    const f = easeIO(Math.min(1, idxF - i));
    const a = framing(i), b = framing(j);
    camera.position.lerpVectors(a.pos, b.pos, f);
    const look = new THREE.Vector3().lerpVectors(a.look, b.look, f);
    // finale: slow push-in + rising stone
    if (i >= N - 1) {
      const fin = Math.min(1, (t - (N - 1) * SEG) / 8);
      camera.position.z -= fin * 0.0; // hold; push handled by lerp staying
      camera.position.add(new THREE.Vector3(0, 0, -fin * 2.5));
      if (stoneGroup.userData.light) stoneGroup.userData.light.intensity = 6 * fin;
      if (stoneGroup.userData.stone) stoneGroup.userData.stone.rotation.y += dt * 0.4;
      bloom.strength = THREE.MathUtils.lerp(bloom.strength, 1.3 + fin * 0.8, 0.05);
    }
    camera.lookAt(look);

    // nearest station → card + stage banner + target fx
    const nearest = Math.min(Math.round(idxF), N - 1);
    if (nearest !== shownIdx) { shownIdx = nearest; showCard(nearest); playStationFugue(nearest); }
    const st = stations[nearest].stage;
    if (st !== shownStage) { shownStage = st; showStage(st); grade.style.background = `radial-gradient(ellipse at center, transparent 30%, ${FX[st].grade})`; }
    progress.style.width = `${Math.min(100, (idxF / (N - 1)) * 100)}%`;

    // lerp colour grade toward target stage
    const T = FX[st];
    cur.bg.lerp(new THREE.Color(T.bg), 0.03);
    cur.amb.lerp(new THREE.Color(T.amb), 0.03);
    cur.key.lerp(new THREE.Color(T.key), 0.03);
    cur.ember.lerp(new THREE.Color(T.ember), 0.03);
    cur.kI = THREE.MathUtils.lerp(cur.kI, T.kI, 0.03);
    cur.bloom = THREE.MathUtils.lerp(cur.bloom, T.bloom, 0.03);
    scene.background.copy(cur.bg); scene.fog.color.copy(cur.bg);
    amb.color.copy(cur.amb); key.color.copy(cur.key); key.intensity = cur.kI;
    emberMat.color.copy(cur.ember);
    if (i < N - 1) bloom.strength = cur.bloom;
    key.position.copy(camera.position);

    if (stageTimer > 0) { stageTimer -= dt; if (stageTimer <= 0) stageEl.classList.remove("show"); }
  }

  // embers drift up + recycle
  const pa = emberGeo.attributes.position;
  for (let k = 0; k < EMBN; k++) {
    pa.array[k * 3 + 1] += dt * (0.4 + (k % 5) * 0.15);
    if (pa.array[k * 3 + 1] > 18) pa.array[k * 3 + 1] = 0;
  }
  pa.needsUpdate = true;
  embers.position.z = camera.position.z; // follow camera column

  composer.render();
}

// ---- audio: the actual emblem fugues rendered through an NES-APU synth ----
const chip = new ChipPlayer();
let audioOn = true, audioReady = false, curFugue = null;
async function startAudio() {
  await chip.load();           // /EmblemRoguelike/assets/fugues.json
  chip.resume();
  audioReady = true;
  chip.setMuted(!audioOn);
  playStationFugue(shownIdx < 0 ? 0 : shownIdx);
}
function playStationFugue(i) {
  if (!audioReady) return;
  const n = stations[i] && stations[i].n;
  if (n && n !== curFugue) { curFugue = n; chip.playEmblem(n, true); }
}

// ---- controls ----
const muteBtn = document.getElementById("gt-mute");
muteBtn.onclick = () => { audioOn = !audioOn; muteBtn.textContent = audioOn ? "♪ sound on" : "♪ muted"; if (audioReady) chip.setMuted(!audioOn); };
const pauseBtn = document.getElementById("gt-pause");
pauseBtn.onclick = () => togglePause();
addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); togglePause(); } });
function togglePause() {
  paused = !paused; pauseBtn.textContent = paused ? "▸ play" : "⏸ pause";
  if (paused) { pausedAt = performance.now(); if (audioReady) chip.setVolume(audioOn ? 0.12 : 0); }
  else { startT += performance.now() - pausedAt; if (audioReady) chip.setMuted(!audioOn); }
}

// ---- boot ----
const gate = document.getElementById("gt-gate");
const beginBtn = document.getElementById("gt-begin");
buildStations().then(() => {
  beginBtn.disabled = false; beginBtn.textContent = "▸ Begin the Work";
  document.getElementById("gt-loading").textContent = `${stations.length} emblems across four stages · ~${Math.round(stations.length * SEG / 60 * 10) / 10} min`;
});
beginBtn.onclick = () => {
  gate.classList.add("gone");
  running = true; startT = performance.now();
  startAudio();
};
requestAnimationFrame(loop);

window.TOUR = { scene, camera, renderer, composer, stations, buildStations, renderOnce: () => composer.render(), begin: () => beginBtn.onclick(), state: () => ({ running, paused, n: stations.length, loaded: stations.filter(s => s.group).length }) };

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CATALOG, COUNTS } from "./catalog.js";
import { buildRelief, loadPlate } from "./relief.js";
import { PROCESS_MAP } from "./processmap.js";
import { makeTour } from "./tour.js";

// ===========================================================================
// gallery.js — browse all 213 plates (51 Atalanta emblems + 162 Hypnerotomachia
// woodcuts); click one to generate and inspect its carved 3D relief.
// ===========================================================================

const grid = document.getElementById("grid");
const viewer = document.getElementById("viewer");
const vTitle = document.getElementById("v-title");
const vEnv = document.getElementById("v-env");
const search = document.getElementById("search");
const countEl = document.getElementById("count");
const depthSlider = document.getElementById("v-depth");
const rotateChk = document.getElementById("v-rotate");
const tourBtn = document.getElementById("v-tour");
const sceneLink = document.getElementById("v-scene");

// shared lab-process tour; visiting the base lab opens the Emblem-VIII
// environment, a specialized lab opens the scene page deep-linked to that lab.
let currentItem = null;
const tour = makeTour({
  onVisitLab: (lab) => {
    tour.close();
    if (lab === "base") location.href = "index.html";
    else location.href = `scene.html?id=${currentItem ? currentItem.id : "af-08"}&lab=${encodeURIComponent(lab)}`;
  },
});

let bookFilter = "all";
countEl.textContent = `${COUNTS.total} plates · ${COUNTS.atalanta} emblems · ${COUNTS.hypnerotomachia} woodcuts · ${COUNTS.occult} occult archive`;

// ---- grid ----
function card(item) {
  const c = document.createElement("button");
  c.className = "card";
  c.dataset.book = item.book;
  c.dataset.title = item.title.toLowerCase();
  c.innerHTML =
    `<div class="thumb"><img loading="lazy" decoding="async" src="${item.img}" alt=""></div>` +
    `<div class="cap">${item.title}</div>`;
  c.addEventListener("click", () => openItem(item));
  return c;
}
function section(label, sub, items) {
  const sec = document.createElement("section");
  sec.className = "book";
  sec.innerHTML = `<h2>${label} <span>· ${sub} · ${items.length} plates</span></h2>`;
  const g = document.createElement("div");
  g.className = "cards";
  items.forEach((it) => g.appendChild(card(it)));
  sec.appendChild(g);
  return sec;
}
function renderGrid() {
  grid.innerHTML = "";
  const showAF = bookFilter === "all" || bookFilter === "atalanta";
  const showHP = bookFilter === "all" || bookFilter === "hypnerotomachia";
  const showOcc = bookFilter === "all" || bookFilter === "occult";
  if (showAF) grid.appendChild(section("Atalanta Fugiens", "Michael Maier, 1617", CATALOG.atalanta));
  if (showHP) grid.appendChild(section("Hypnerotomachia Poliphili", "Francesco Colonna, 1499", CATALOG.hypnerotomachia));
  if (showOcc && CATALOG.collections)
    CATALOG.collections.forEach((c) => grid.appendChild(section(c.label, c.sub, c.items)));
  applySearch();
}
function applySearch() {
  const q = search.value.trim().toLowerCase();
  document.querySelectorAll(".card").forEach((c) => {
    c.style.display = !q || c.dataset.title.includes(q) ? "" : "none";
  });
}
document.querySelectorAll(".f-btn").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".f-btn").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    bookFilter = b.dataset.book;
    renderGrid();
  })
);
search.addEventListener("input", applySearch);
renderGrid();

// ---- 3D relief viewer (single persistent renderer) ----
let renderer, scene, camera, controls, current = null, raf = null;

function initViewer() {
  const canvas = document.getElementById("v-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14110b);
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0xb8ad90, 0.45));
  const key = new THREE.DirectionalLight(0xfff2d6, 1.25);
  key.position.set(-5, 3, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); scene.add(key);
  const rake = new THREE.DirectionalLight(0xffe6c0, 1.15); // low raking light → relief shadows
  rake.position.set(4, -1.5, 1.5); scene.add(rake);
  const fill = new THREE.HemisphereLight(0xddd4ba, 0x39301f, 0.5); scene.add(fill);

  addEventListener("resize", () => { if (viewer.classList.contains("open")) resizeViewer(); });
}
function resizeViewer() {
  const r = viewer.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height || 1;
  camera.updateProjectionMatrix();
}
function disposeCurrent() {
  if (!current) return;
  current.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      if (o.material.displacementMap && o.material.displacementMap !== o.material.map)
        o.material.displacementMap.dispose();
      o.material.dispose();
    }
  });
  scene.remove(current);
  current = null;
}
function frameCamera(w, h) {
  const d = Math.max(w, h) * 1.45;
  camera.position.set(0, 0, d);
  controls.target.set(0, 0, 0);
  controls.minDistance = d * 0.4; controls.maxDistance = d * 2.5;
  controls.update();
}

async function openItem(item) {
  if (!renderer) initViewer();
  viewer.classList.add("open");
  viewer.classList.add("loading");
  resizeViewer();
  vTitle.textContent = item.title;
  currentItem = item;
  vEnv.style.display = item.id === "af-08" ? "" : "none";
  // every plate links to its lab-process tour; emblems also get a walkable scene
  tourBtn.onclick = () => tour.openProcess(PROCESS_MAP[item.id], item.title);
  if (item.book === "atalanta") { sceneLink.style.display = ""; sceneLink.href = `scene.html?id=${item.id}`; }
  else sceneLink.style.display = "none";
  disposeCurrent();
  try {
    const { tex, aspect } = await loadPlate(item.img);
    const g = buildRelief(tex, aspect, { depth: parseFloat(depthSlider.value) });
    current = g;
    scene.add(g);
    frameCamera(g.userData.width, g.userData.height);
  } catch (e) {
    vTitle.textContent = item.title + " — (image failed to load)";
  }
  viewer.classList.remove("loading");
  if (!raf) loop();
}
function closeViewer() {
  viewer.classList.remove("open");
  if (raf) { cancelAnimationFrame(raf); raf = null; }
}
document.getElementById("v-back").addEventListener("click", closeViewer);
addEventListener("keydown", (e) => { if (e.key === "Escape") closeViewer(); });
depthSlider.addEventListener("input", () => { if (current) current.userData.setDepth(parseFloat(depthSlider.value)); });

let spin = 0;
function loop() {
  raf = requestAnimationFrame(loop);
  if (rotateChk.checked && current) { spin += 0.004; current.rotation.y = Math.sin(spin) * 0.55; }
  else if (current) current.rotation.y *= 0.95;
  controls.update();
  renderer.render(scene, camera);
}

// expose for debugging / verification (headless rAF is paused)
window.GAL = {
  CATALOG, COUNTS,
  openItem,
  renderOnce: () => { if (renderer) renderer.render(scene, camera); },
  get current() { return current; },
  get renderer() { return renderer; },
};

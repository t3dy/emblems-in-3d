import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { EMBLEMDATA } from "./emblemdata.js";
import { PROCESS_MAP } from "./processmap.js";
import { SPECIALIZED_LABS, PROCESSES } from "./processes.js";
import { buildProp, makeFigure } from "./props.js?v=6";
import { makeTour } from "./tour.js";
import { EXPLAIN } from "./emblem_explanations.js";
import { ChipPlayer } from "./chiptune.js";
import { LOCATION, SETTINGS } from "./locations.js";
import { BESPOKE } from "./bespoke.js?v=4";
import { makeSkyGradient } from "./textures.js?v=2";
import { buildSpace, armatureFor, paramsFor } from "./spaces.js";

// ===========================================================================
// scene-legacy.js — PRESERVED SNAPSHOT, not the live site. This is the
// perspective-armature / synthetic-3D-prop system (see docs/HISTORY.md,
// Stage 3) that scene.js used before the papercraft pivot: generic rooms
// (interiorBox/walledCourt/figureLandscape/diagramWall from spaces.js) built
// from primitive geometry, populated with primitive stand-in props
// (spheres/cones/capsules for "egg," "lion," "farmhouse," …) from props.js,
// plus hand-placed bespoke.js compositions. Kept running and linked from the
// gallery/history page specifically so it can be compared side-by-side
// against the current papercraft tunnel-book (scene.js) — not deleted, per
// the "show off all versions at every stage" request.
// ===========================================================================

// ---- toon shading factory (shared look) ----
function makeGradientMap(steps = 4, floorV = 0.42) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round((floorV + (1 - floorV) * (i / (steps - 1))) * 255);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true; return tex;
}
const GRAD = makeGradientMap();
const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: GRAD, ...o });
const ctx = { toon };

// ---- which emblem ----
const params = new URLSearchParams(location.search);
const id = params.get("id") || "af-01";
const n = parseInt((id.match(/(\d+)/) || [0, 1])[1], 10);
const data = EMBLEMDATA[String(n)] || EMBLEMDATA["1"];

const canvas = document.getElementById("s-canvas");
const titleEl = document.getElementById("s-title");
const settingLabelEl = document.getElementById("s-setting");
const loadingEl = document.getElementById("s-loading");
titleEl.textContent = `Emblem ${data.roman} — ${data.mottoEn}`;
document.getElementById("s-env").style.display = id === "af-08" ? "" : "none";
document.getElementById("s-relief").onclick = () => (location.href = `gallery.html`);

// ---- renderer / scene / camera ----
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
camera.position.set(0, 3.2, 12);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.target.set(0, 1.4, -2);

const hemi = new THREE.HemisphereLight(0xe7dfc6, 0x39301f, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
sun.position.set(-8, 14, 8); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); scene.add(sun);

// ---------------------------------------------------------------------------
// Post-processing: toon render + Sobel ink edges — the same "woodcut" pass
// the Emblem VIII flagship uses (main.js's EdgeInkShader), generalized here
// so every emblem's diorama gets the engraving's dark contour lines instead
// of flat-shaded polygon silhouettes.
// ---------------------------------------------------------------------------
const EdgeInkShader = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2() }, inkColor: { value: new THREE.Color(0x1c140c) }, strength: { value: 0.8 }, inkMax: { value: 0.5 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform vec3 inkColor; uniform float strength; uniform float inkMax;
    varying vec2 vUv;
    float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
    float grain(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 px = 1.0 / resolution;
      float tl=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,1.)).rgb);
      float  t=lum(texture2D(tDiffuse,vUv+px*vec2( 0.,1.)).rgb);
      float tr=lum(texture2D(tDiffuse,vUv+px*vec2( 1.,1.)).rgb);
      float  l=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,0.)).rgb);
      float  r=lum(texture2D(tDiffuse,vUv+px*vec2( 1.,0.)).rgb);
      float bl=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,-1.)).rgb);
      float  b=lum(texture2D(tDiffuse,vUv+px*vec2( 0.,-1.)).rgb);
      float br=lum(texture2D(tDiffuse,vUv+px*vec2( 1.,-1.)).rgb);
      float gx = -tl -2.0*l -bl + tr +2.0*r + br;
      float gy =  tl +2.0*t +tr - bl -2.0*b - br;
      float edge = sqrt(gx*gx + gy*gy) * strength;
      float ink = smoothstep(0.5, 1.25, edge) * inkMax;
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 col = mix(base, inkColor, ink);
      // static paper grain — fine tonal speckle like laid paper (not animated,
      // so it reads as the sheet's surface rather than film noise)
      col *= 0.96 + 0.08 * grain(floor(vUv * resolution * 0.5));
      // vignette — darkened plate corners, like the wiped edges of an intaglio print
      vec2 vc = vUv - 0.5;
      col *= 1.0 - 0.32 * smoothstep(0.28, 0.72, dot(vc, vc) * 2.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const inkPass = new ShaderPass(EdgeInkShader);
composer.addPass(inkPass);
composer.addPass(new OutputPass()); // linear→sRGB conversion; without it the composer output renders far too dark

let world = new THREE.Group(); scene.add(world);
const anim = { flames: [], lums: [], birds: [] };

// ---------------------------------------------------------------------------
// Walk mode — first-person exploration of the diorama, in place of the
// default orbit preview. Reuses PointerLockControls the same way the
// Emblem-VIII flagship environment (main.js) does, so every emblem's diorama
// becomes a walkable space, not just a turntable.
// ---------------------------------------------------------------------------
const plControls = new PointerLockControls(camera, document.body);
const walkOverlay = document.getElementById("s-walk-overlay");
const walkReticle = document.getElementById("s-reticle");
const walkBtn = document.getElementById("s-walk");
const readBtn = document.getElementById("s-read");
let walking = false;
const walkKeys = {};
// the current space's doorway spawn + walk clamp, set by each armature (spaces.js)
let spawnPos = { pos: new THREE.Vector3(0, 1.7, 11), look: new THREE.Vector3(0, 1.6, -8) };
let walkBounds = { minX: -19, maxX: 19, minZ: -19, maxZ: 19 };

const player = new ChipPlayer();
player.load().catch(() => {});

function enterWalk() {
  camera.position.copy(spawnPos.pos);
  plControls.lock();
}
function exitWalk() { plControls.unlock(); }

walkBtn.onclick = () => { if (walking) exitWalk(); else { walkOverlay.classList.remove("hidden"); } };
walkOverlay.onclick = enterWalk;
plControls.addEventListener("lock", () => {
  walking = true; controls.enabled = false;
  walkOverlay.classList.add("hidden"); walkReticle.classList.remove("hidden");
  walkBtn.textContent = "◂ Exit walk mode"; document.getElementById("s-hint").textContent = "WASD move · mouse look · E operate · R read · ESC release";
  player.playEmblem(n, true);
});
plControls.addEventListener("unlock", () => {
  walking = false; controls.enabled = true;
  walkReticle.classList.add("hidden"); walkBtn.textContent = "🚶 Walk this scene";
  document.getElementById("s-hint").textContent = "drag to orbit · scroll to zoom";
  player.stop();
  if (!readOpen) walkOverlay.classList.add("hidden");
});
addEventListener("keydown", (e) => { if (walking) walkKeys[e.code] = true; });
addEventListener("keyup", (e) => { walkKeys[e.code] = false; });

function updateWalk(dt) {
  if (!walking) return;
  const speed = 4.6 * dt;
  if (walkKeys.KeyW || walkKeys.ArrowUp) plControls.moveForward(speed);
  if (walkKeys.KeyS || walkKeys.ArrowDown) plControls.moveForward(-speed);
  if (walkKeys.KeyD || walkKeys.ArrowRight) plControls.moveRight(speed);
  if (walkKeys.KeyA || walkKeys.ArrowLeft) plControls.moveRight(-speed);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, walkBounds.minX, walkBounds.maxX);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, walkBounds.minZ, walkBounds.maxZ);
  camera.position.y = 1.7;
}

// ---------------------------------------------------------------------------
// Read the Emblem — the de Jong-derived scholarship (short + deep-dive)
// ingested from the Claudiens DB, surfaced for whichever emblem is loaded.
// ---------------------------------------------------------------------------
const readPanel = document.createElement("div");
readPanel.className = "rm-panel";
document.body.appendChild(readPanel);
let readOpen = false;

function renderReadPanel() {
  const ex = EXPLAIN[String(n)] || {};
  readPanel.innerHTML = `
    <div class="rm-head">
      <span class="rm-title">Read the Emblem · ${data.roman}</span>
      <button class="rm-close" title="Close (R / Esc)">✕</button>
    </div>
    <div class="rm-body">
      <div class="rm-card rm-prose">
        <p class="rm-symbol">${ex.motto || data.mottoEn || ""}</p>
        <h3>Emblem ${data.roman}</h3>
        <p class="rm-section-label">The main idea</p>
        <p>${ex.short || "No scholarship note catalogued for this plate yet."}</p>
        <p class="rm-section-label">Deep dive — after H.M.E. de Jong (1969)</p>
        ${ex.deep || ""}
        <p class="rm-cite">Discourse synthesis drawn from the Claudiens DB (de Jong, Sheppard, Newman, Principe).</p>
      </div>
    </div>`;
  readPanel.querySelector(".rm-close").onclick = () => closeRead();
}

function openRead() {
  renderReadPanel();
  readOpen = true; readPanel.classList.add("show");
  walkOverlay.classList.add("hidden");
}
function closeRead() {
  readOpen = false; readPanel.classList.remove("show");
  if (walking) plControls.lock();
}
readBtn.onclick = () => (readOpen ? closeRead() : openRead());
addEventListener("keydown", (e) => {
  if (e.code === "KeyR" && (walking || !plControls.isLocked)) { readOpen ? closeRead() : openRead(); }
  else if (e.code === "Escape" && readOpen) closeRead();
});

function hexToColor(h, fallback) { try { return new THREE.Color(h); } catch { return new THREE.Color(fallback); } }

// ---------------------------------------------------------------------------
// Operate the emblem — the game loop. Aim (via the walk-mode reticle) at the
// central alchemical object and press E: each press advances one authentic
// bench step of this emblem's operation (from processes.js, after Principe /
// Newman / Moran / Rampling), with the step text shown as a toast. Reaching
// the last step completes the operation and shows its summary + citation.
// This is the same mechanic as Emblem VIII's "strike the egg," generalized
// across all 51 plates via PROCESS_MAP.
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
let opStep = 0, opDone = false;
const toastEl = document.createElement("div");
toastEl.className = "s-toast hidden";
document.body.appendChild(toastEl);
let toastTimer = null;
function showToast(html, ms = 3200) {
  toastEl.innerHTML = html; toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
}
function hideToast() { toastEl.classList.add("hidden"); clearTimeout(toastTimer); }

function currentProcess() {
  return PROCESSES[PROCESS_MAP[id]] || null;
}

// pulls this specific emblem's own mythological/symbolic reading (not the
// generic process text) into the completion payoff, so finishing the
// operation ties back to what THIS plate — its own figures and myth — means,
// per de Jong's discourse synthesis, not just the bench procedure it shares
// with other plates under the same process.
function mythHook() {
  const short = (EXPLAIN[String(n)] || {}).short;
  if (!short) return "";
  const firstSentence = short.split(/(?<=[.!?])\s+/)[0];
  return firstSentence;
}

function pulse(obj) {
  obj.userData.pulseT = 0;
}

function operate() {
  if (!walking) return;
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = raycaster.intersectObjects(anim.interactables, true);
  if (!hits.length || hits[0].distance > 7) {
    showToast(`<p class="s-toast-hint">Nothing to operate here — aim at the egg, vessel, furnace, or bench.</p>`, 2000);
    return;
  }
  let target = hits[0].object;
  while (target.parent && !anim.interactables.includes(target)) target = target.parent;
  pulse(target);
  const proc = currentProcess();
  if (!proc) { showToast(`<p class="s-toast-hint">This object holds no catalogued operation yet.</p>`, 2000); return; }
  if (opDone) {
    showToast(`<p class="s-toast-title">${proc.name} — already complete</p><p class="s-toast-body">${proc.summary}</p>`, 2600);
    return;
  }
  const stepText = proc.steps[opStep];
  opStep++;
  accLightPulse = 1;
  if (opStep >= proc.steps.length) {
    opDone = true;
    const myth = mythHook();
    showToast(
      `<p class="s-toast-title">${proc.name} complete — ${data.mottoEn}</p>` +
        `<p class="s-toast-body">${proc.summary}</p>` +
        (myth ? `<p class="s-toast-body">${myth}</p>` : "") +
        `<p class="s-toast-cite">${proc.cite}</p>`,
      5200
    );
  } else {
    showToast(`<p class="s-toast-title">${proc.name} — step ${opStep}/${proc.steps.length}</p><p class="s-toast-body">${stepText}</p>`);
  }
}
let accLightPulse = 0;
addEventListener("keydown", (e) => { if (e.code === "KeyE") operate(); });

function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return; // viewport not laid out yet — retried on the next frame below
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  composer.setSize(w, h);
  inkPass.uniforms.resolution.value.copy(renderer.getDrawingBufferSize(new THREE.Vector2()));
}
addEventListener("resize", resize); resize();
requestAnimationFrame(resize); // guards against a 0x0 viewport at initial script execution

function clearWorld() {
  world.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { const m = o.material; if (m.map) m.map.dispose(); m.dispose(); }
  });
  scene.remove(world); world = new THREE.Group(); scene.add(world);
  anim.flames = []; anim.lums = []; anim.birds = [];
  anim.interactables = []; opStep = 0; opDone = false; hideToast();
}

// ---- ground + backdrop plate ----
function ground(color) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), toon({ color }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; world.add(g);
}

// ---- toggleable source-plate reference, mounted on the far wall ----
let sourcePlate = null;
let plateVisible = true;
function buildTogglePlate(img, plate) {
  const tex = new THREE.TextureLoader().load(img); tex.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(plate.w + 0.3, plate.h + 0.3, 0.12), toon({ color: 0x3a2c1a }));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(plate.w, plate.h), new THREE.MeshBasicMaterial({ map: tex }));
  pic.position.z = 0.08;
  grp.add(frame, pic);
  grp.position.set(plate.pos[0], plate.pos[1], plate.pos[2]);
  grp.rotation.y = plate.rotY || 0;
  grp.visible = plateVisible;
  world.add(grp); sourcePlate = grp;
}
function togglePlate() { plateVisible = !plateVisible; if (sourcePlate) sourcePlate.visible = plateVisible; return plateVisible; }

// ---- classify a tag into a placement zone ----
function zoneOf(t) {
  t = t.toLowerCase();
  const has = (...k) => k.some((x) => t.includes(x));
  if (has("sun", "moon", "sol", "luna", "light", "radiance", "sky", "star")) return "sky";
  if (has("water", "stream", "river", "sea", "meadow", "field", "landscape", "earth", "ground", "mountain", "rock", "tree", "garden", "forest", "rose", "classical_architecture", "classical_scene", "classical_landscape", "classical_setting", "classical_columns", "garden_walls", "column", "pillar", "temple")) return "scenery";
  if (has("dragon", "serpent", "snake", "lion", "wolf", "dog", "toad", "frog", "eagle", "bird", "phoenix", "nest", "raven", "owl")) return "creature";
  if (has("egg", "sword", "vessel", "flask", "retort", "alembic", "fire", "flame", "furnace", "table", "altar", "cup", "wine", "gold", "seed", "apple", "stone", "vase", "kiln", "clay_vessel", "potter", "gold_ore", "ore_vessel", "bed", "wedding_chamber")) return "central";
  if (has("infant", "child", "man", "woman", "king", "queen", "figure", "nurse", "brother", "sister", "boreas", "farmer", "philosopher", "oedipus", "venus", "latona", "isis", "ceres", "hermaphrodite", "salamander", "hand")) return "actor";
  return "central";
}

function place(group, x, y, z) { group.position.set(x, y, z); world.add(group); return group; }

function buildEmblemScene() {
  clearWorld();
  const stage = (data.stage || "").toUpperCase();
  const accent = hexToColor(data.palette.glow, "#caa45a");

  const moodBg = { NIGREDO: 0x14110b, ALBEDO: 0x2a2c2e, CITRINITAS: 0x2a2412, RUBEDO: 0x24140e }[stage] || 0x1a160e;
  scene.background = makeSkyGradient(moodBg);
  scene.fog = new THREE.Fog(moodBg, 22, 60);
  hemi.intensity = stage === "NIGREDO" ? 0.55 : stage === "ALBEDO" ? 1.05 : 0.85;
  sun.intensity = stage === "ALBEDO" ? 1.3 : 1.0;

  const setting = LOCATION[String(n)] || "hillside";
  const settingDef = SETTINGS[setting] || SETTINGS.hillside;
  settingLabelEl.textContent = setting[0].toUpperCase() + setting.slice(1);

  const arm = armatureFor(n, setting);
  const space = buildSpace(arm, { THREE, ctx, world, anim }, paramsFor(setting));
  spawnPos = space.spawn; walkBounds = space.bounds;
  buildTogglePlate(data.img, space.plate);

  const accLight = new THREE.PointLight(accent.getHex(), stage === "NIGREDO" ? 3 : 2, 24, 2);
  accLight.userData.base = accLight.intensity;
  accLight.position.set(space.anchors.central.x, 3.2, space.anchors.central.z + 1);
  world.add(accLight); anim.lums.push(accLight);

  const zoneAnchor = { sky: space.anchors.sky, scenery: space.anchors.scenery, creature: space.anchors.creature, central: space.anchors.central, actor: space.anchors.actors };
  const byZone = {};
  data.elements.forEach((t) => { const z = zoneOf(t); (byZone[z] ||= []).push(t); });

  Object.entries(byZone).forEach(([zone, tags]) => {
    const a = zoneAnchor[zone] || space.anchors.central;
    const spread = zone === "scenery" ? 6 : zone === "actor" ? 3 : 2.4;
    tags.forEach((t, i) => {
      const p = buildProp(ctx, t);
      const off = tags.length <= 1 ? 0 : (i / (tags.length - 1) - 0.5) * spread;
      place(p, a.x + off, a.y, a.z + (i % 2) * 0.9);
      if (zone === "actor") p.rotation.y = -(a.x + off) * 0.05;
      if (p.userData.flame) anim.flames.push(p);
      if (zone === "sky") anim.lums.push(p);
      if (t.toLowerCase().includes("bird") || t.toLowerCase().includes("eagle")) anim.birds.push(p);
      if (zone === "central") anim.interactables.push(p);
    });
  });

  if (!byZone.actor) place(makeFigure(ctx, {}), space.anchors.actors.x, 0, space.anchors.actors.z);

  const bespokeStage = BESPOKE[String(n)];
  if (bespokeStage) bespokeStage({ THREE, ctx, place, buildProp, makeFigure, world, anim, data });

  camera.position.copy(space.spawn.pos); controls.target.copy(space.spawn.look); controls.update();
  titleEl.textContent = `Emblem ${data.roman} — ${data.mottoEn}`;
  document.getElementById("s-env").style.display = id === "af-08" ? "" : "none";
}

// ---- a purpose-built specialized laboratory ----
function buildSpecialLab(name) {
  clearWorld();
  const def = SPECIALIZED_LABS[name];
  scene.background = new THREE.Color(0x16120c);
  scene.fog = new THREE.Fog(0x16120c, 20, 55);
  hemi.intensity = 0.8; sun.intensity = 0.9;

  // room shell
  const brick = toon({ color: 0x6f5a40 });
  ground(0x55503f);
  const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 7, 0.5), brick); m.position.set(x, 3.5, z); m.rotation.y = ry; world.add(m); };
  wall(26, 0, -10, 0); wall(20, -13, 0, Math.PI / 2); wall(20, 13, 0, Math.PI / 2);

  // long work bench
  const wood = toon({ color: 0x6e5436 });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(16, 0.25, 1.8), wood);
  bench.position.set(0, 1.1, -6); world.add(bench);

  // apparatus along the bench
  const apps = def ? def.apparatus : ["vessel", "furnace", "crucible"];
  apps.forEach((a, i) => {
    const p = buildProp(ctx, a);
    const x = (i / Math.max(1, apps.length - 1) - 0.5) * 13;
    p.position.set(x, 1.25, -6); world.add(p);
    if (p.userData.flame) anim.flames.push(p);
  });
  // a working furnace at the side
  const fire = buildProp(ctx, "furnace"); fire.position.set(-9, 0.3, -2); world.add(fire);
  if (fire.userData.flame) anim.flames.push(fire);
  // an attendant
  const attendant = makeFigure(ctx, {}); attendant.position.set(4, 0, -3); world.add(attendant);

  camera.position.set(0, 3.4, 9); controls.target.set(0, 1.6, -6); controls.update();
  titleEl.textContent = `${name} — ${def ? def.purpose : "specialized laboratory"}`;
  // offer a way back to the emblem scene
  showBack(() => buildEmblemScene());
}

// ---- back button management (gallery vs. return-to-scene) ----
const backLink = document.getElementById("s-back");
const backDefault = backLink.getAttribute("href");
function showBack(fn) {
  backLink.textContent = "◂ Back to the emblem";
  backLink.removeAttribute("href");
  backLink.onclick = (e) => { e.preventDefault(); backLink.textContent = "◂ Gallery"; backLink.setAttribute("href", backDefault); backLink.onclick = null; fn(); };
}

// ---- tour wiring ----
const tour = makeTour({
  onVisitLab: (lab) => {
    tour.close();
    if (lab === "base") location.href = "index.html"; // the Emblem-VIII environment IS the base lab
    else buildSpecialLab(lab);
  },
});
document.getElementById("s-tour").onclick = () => tour.openProcess(PROCESS_MAP[id] || data.process, `Emblem ${data.roman} — ${data.mottoEn}`);

// ---- pop-up toggle: figures popped (default) vs. flat plate only (P key) ----
const plateBtn = document.getElementById("s-plate");
function refreshPlateBtn(figuresVisible) { if (plateBtn) plateBtn.textContent = figuresVisible ? "🖼 Flatten to plate" : "🖼 Pop up the figures"; }
if (plateBtn) plateBtn.onclick = () => refreshPlateBtn(togglePlate());
addEventListener("keydown", (e) => { if (e.code === "KeyP") refreshPlateBtn(togglePlate()); });
refreshPlateBtn(true);

// ---- render loop ----
let t0 = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - t0) / 1000 || 0, 0.05); t0 = t; const tt = t / 1000;
  anim.flames.forEach((f, i) => f.children.forEach((c) => { if (c.material && c.material.blending === THREE.AdditiveBlending) { c.scale.y = 1 + Math.sin(tt * (8 + i) + i) * 0.25; c.material.opacity = 0.7 + Math.sin(tt * 9 + i) * 0.2; } }));
  accLightPulse = Math.max(0, accLightPulse - dt * 1.6);
  anim.lums.forEach((l) => { if (l.isPointLight) l.intensity = (l.userData.base || l.intensity) * (1 + accLightPulse * 1.8); });
  anim.birds.forEach((b, i) => { b.position.y = 2.4 + Math.sin(tt + i) * 0.3; b.position.x += Math.sin(tt * 0.4 + i) * dt * 0.4; });
  anim.interactables.forEach((o) => {
    if (o.userData.pulseT == null) return;
    o.userData.pulseT += dt * 4;
    const k = 1 + Math.max(0, Math.sin(o.userData.pulseT)) * 0.35 * Math.max(0, 1 - o.userData.pulseT / Math.PI);
    o.scale.setScalar(k);
    if (o.userData.pulseT > Math.PI) { o.userData.pulseT = null; o.scale.setScalar(1); }
  });
  updateWalk(dt);
  controls.update();
  composer.render();
}

// ---- go ----
buildEmblemScene();
// deep-link straight into a specialized lab if requested (?lab=Distillation Hall)
const wantLab = params.get("lab");
if (wantLab && SPECIALIZED_LABS[wantLab]) buildSpecialLab(wantLab);
loadingEl.style.display = "none";
requestAnimationFrame(loop);

window.SCENE = {
  scene, camera, renderer, data, buildEmblemScene, buildSpecialLab, tour,
  renderOnce: () => composer.render(),
  operate, anim, currentProcess,
  debugForceWalk: (v) => { walking = v; },
  debugState: () => ({ opStep, opDone, walking }),
  debugAimAt: (obj) => {
    const p = obj.position;
    camera.position.set(p.x, 1.6, p.z + 5);
    camera.lookAt(p.x, p.y + 0.5, p.z);
  },
  debugRaycast: () => {
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = raycaster.intersectObjects(anim.interactables, true);
    return hits.map((h) => ({ tag: h.object.userData.tag, dist: h.distance }));
  },
  debugRaycastDirect: (obj) => {
    scene.updateMatrixWorld(true);
    const worldPos = obj.getWorldPosition(obj.position.clone());
    const dir = worldPos.clone().sub(camera.position).normalize();
    raycaster.set(camera.position, dir);
    const hits = raycaster.intersectObjects(anim.interactables, true);
    return { hits: hits.map((h) => ({ tag: h.object.userData.tag, dist: h.distance })), worldPos: worldPos.toArray() };
  },
};

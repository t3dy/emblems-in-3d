import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { EMBLEM8 } from "./content.js";
import { runIntro, makeReadMode } from "./cutscene.js";
import { buildLab } from "./lab.js";

// ===========================================================================
// EMBLEMS IN 3D — Emblem VIII of Maier's Atalanta Fugiens (1617):
//   "Accipe ovum & igneo percute gladio."
//   "Take the egg and strike it with a fiery sword."
//
// A walkable, toon/woodcut-shaded courtyard reconstructing the engraving:
// tiled floor in perspective, crenellated walls, the furnace at left, the
// philosophical egg on a bench, the adept with his fiery sword, a right-wall
// portal, and — beyond the walls — the town: a Gothic church spire, stepped-
// gable houses, round towers, trees and a bird. Aim at the egg and press E
// to perform the operation.
// ===========================================================================

const PALETTE = {
  sky:     0xc8c1ad,
  paper:   0xe9dcc0,
  stone:   0x9b917a,
  stoneDk: 0x6f6655,
  brick:   0x8a7559,
  brickDk: 0x5d4c37,
  wood:    0x6e5436,
  shell:   0xece2cb,
  roof:    0x6a4632,
  roofDk:  0x4f3526,
  spire:   0x55524a,
  leaf:    0x55603a,
  fire:    0xff7a1a,
  ember:   0xffd27a,
  glow:    0xfff0c0,
  ink:     0x1b140b,
};

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.sky, 28, 110);

const camera = new THREE.PerspectiveCamera(
  70, window.innerWidth / window.innerHeight, 0.1, 400
);
camera.position.set(0, 1.7, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// Toon shading: quantized gradient ramp + a Sobel "ink" post pass = woodcut
// ---------------------------------------------------------------------------
function makeGradientMap(steps, floorV = 0.42) {
  // map the lit ramp into [floorV, 1] so shadowed faces band to a paper-tone,
  // never pure black — the woodcut-on-cream-paper look
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++)
    data[i] = Math.round((floorV + (1 - floorV) * (i / (steps - 1))) * 255);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
const GRAD = makeGradientMap(4);
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: GRAD, ...opts });

// ---------------------------------------------------------------------------
// Lighting — overcast engraving daylight + warm furnace point light
// ---------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xe9e2cb, 0x595139, 1.15));
scene.add(new THREE.AmbientLight(0xb8ad90, 0.25));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.25);
sun.position.set(-9, 18, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 70;
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24 });
scene.add(sun);

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------
function makeCheckerTexture(size = 512, squares = 8, rx = 10, ry = 14) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const s = size / squares;
  for (let y = 0; y < squares; y++)
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#827860" : "#a59c84";
      ctx.fillRect(x * s, y * s, s, s);
      ctx.strokeStyle = "rgba(60,52,38,0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x * s, y * s, s, s);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBrickTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5d4c37";
  ctx.fillRect(0, 0, 256, 256);
  const bw = 64, bh = 24;
  for (let row = 0, y = 0; y < 256; y += bh, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 256; x += bw) {
      ctx.fillStyle = `hsl(30,28%,${30 + ((x * 7 + row * 13) % 12)}%)`;
      ctx.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// stone facade with rows of dark windows — for the town buildings
function makeFacadeTexture(cols, rows, base = "#9b917a") {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  const mx = 128 / cols, my = 128 / rows;
  for (let r = 0; r < rows; r++)
    for (let cc = 0; cc < cols; cc++) {
      ctx.fillStyle = "#4f4131";
      const w = mx * 0.45, h = my * 0.6;
      ctx.fillRect(cc * mx + (mx - w) / 2, r * my + (my - h) / 2, w, h);
      ctx.strokeStyle = "rgba(40,30,18,0.5)";
      ctx.strokeRect(cc * mx + (mx - w) / 2, r * my + (my - h) / 2, w, h);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const floorMat = toon({ map: makeCheckerTexture() });
const brickMat = toon({ map: makeBrickTexture() });
const stoneMat = toon({ color: PALETTE.stone });
const woodMat = toon({ color: PALETTE.wood });

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 60), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ---------------------------------------------------------------------------
// Courtyard walls
// ---------------------------------------------------------------------------
const SIDE_H = 9;          // tall side walls (furnace + portal live here)
const BACK_H = 6.2;        // low back wall so the town shows above it
const COURT_HALF = 11;     // x extent
const BACK_Z = -16;        // back wall z
const FRONT_Z = 18;        // front (entry) wall z — holds the source engraving
const ARCH_W = 4.2;        // tunnel mouth width

function box(w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  return m;
}

// side walls (length spans FRONT_Z..BACK_Z = 34, centered at z=1)
const sideLen = FRONT_Z - BACK_Z;
box(sideLen, SIDE_H, 0.6, brickMat, -COURT_HALF, SIDE_H / 2, (FRONT_Z + BACK_Z) / 2, Math.PI / 2);
// right wall, split around a doorway (z ~ -4) leading EAST to the laboratory
const DOOR_Z0 = -5.4, DOOR_Z1 = -2.6;
box(DOOR_Z0 - BACK_Z, SIDE_H, 0.6, brickMat, COURT_HALF, SIDE_H / 2, (BACK_Z + DOOR_Z0) / 2, Math.PI / 2);
box(FRONT_Z - DOOR_Z1, SIDE_H, 0.6, brickMat, COURT_HALF, SIDE_H / 2, (DOOR_Z1 + FRONT_Z) / 2, Math.PI / 2);
box(DOOR_Z1 - DOOR_Z0, SIDE_H - 4.6, 0.6, brickMat, COURT_HALF, 4.6 + (SIDE_H - 4.6) / 2, (DOOR_Z0 + DOOR_Z1) / 2, Math.PI / 2); // lintel

// back wall, split around the central archway
const sideW = (COURT_HALF * 2 - ARCH_W) / 2;
box(sideW, BACK_H, 0.6, brickMat, -(ARCH_W / 2 + sideW / 2), BACK_H / 2, BACK_Z);
box(sideW, BACK_H, 0.6, brickMat, (ARCH_W / 2 + sideW / 2), BACK_H / 2, BACK_Z);
box(ARCH_W + 0.4, BACK_H - 4.6, 0.6, brickMat, 0, 4.6 + (BACK_H - 4.6) / 2, BACK_Z); // lintel

// front wall (entry side, behind spawn) — closes the courtyard
box(COURT_HALF * 2, SIDE_H, 0.6, brickMat, 0, SIDE_H / 2, FRONT_Z);

// --- crenellations (merlons) atop walls -----------------------------------
function crenellate(length, x, z, ry, top, step = 1.4, mw = 0.7, mh = 0.7) {
  const g = new THREE.Group();
  const n = Math.floor(length / step);
  for (let i = 0; i <= n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, 0.7), brickMat);
    m.position.x = -length / 2 + i * step;
    m.castShadow = true;
    g.add(m);
  }
  g.position.set(x, top + mh / 2, z);
  g.rotation.y = ry;
  scene.add(g);
}
crenellate(COURT_HALF * 2 - 0.2, 0, BACK_Z, 0, BACK_H);                       // back wall
crenellate(sideLen - 0.2, -COURT_HALF, 1, Math.PI / 2, SIDE_H);              // left wall
crenellate(sideLen - 0.2, COURT_HALF, 1, Math.PI / 2, SIDE_H);              // right wall

// --- blind arcade: a row of small dark arches on the back wall ------------
(function arcade() {
  const archMat = new THREE.MeshBasicMaterial({ color: 0x231a10 });
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const xx = side * (ARCH_W / 2 + 1.0 + i * 1.6);
      const niche = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), archMat);
      niche.position.set(xx, 2.6, BACK_Z + 0.32);
      scene.add(niche);
    }
  }
})();

// ---------------------------------------------------------------------------
// The vaulted tunnel — receding vault to a glowing doorway at the far end
// ---------------------------------------------------------------------------
const tunnelMat = toon({ color: PALETTE.brickDk, side: THREE.DoubleSide });
const TUNNEL_DEPTH = 22;
const tunnel = new THREE.Group();

const vault = new THREE.Mesh(
  new THREE.CylinderGeometry(ARCH_W / 2, ARCH_W / 2, TUNNEL_DEPTH, 24, 1, true, 0, Math.PI),
  tunnelMat
);
vault.rotation.z = Math.PI / 2;
vault.rotation.y = Math.PI / 2;
vault.position.set(0, 2.3, BACK_Z - TUNNEL_DEPTH / 2);
tunnel.add(vault);

for (const sx of [-ARCH_W / 2, ARCH_W / 2]) {
  const sw = new THREE.Mesh(new THREE.PlaneGeometry(TUNNEL_DEPTH, 2.3), tunnelMat);
  sw.position.set(sx, 1.15, BACK_Z - TUNNEL_DEPTH / 2);
  sw.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
  tunnel.add(sw);
}
const tfloor = new THREE.Mesh(
  new THREE.PlaneGeometry(ARCH_W, TUNNEL_DEPTH),
  toon({ map: makeCheckerTexture(256, 4, 1, 6) })
);
tfloor.rotation.x = -Math.PI / 2;
tfloor.position.set(0, 0.02, BACK_Z - TUNNEL_DEPTH / 2);
tunnel.add(tfloor);

const doorGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(ARCH_W * 0.66, 2.9),
  new THREE.MeshBasicMaterial({ color: PALETTE.glow })
);
doorGlow.position.set(0, 1.5, BACK_Z - TUNNEL_DEPTH + 0.25);
tunnel.add(doorGlow);
const doorLight = new THREE.PointLight(PALETTE.glow, 7, 34, 1.5);
doorLight.position.set(0, 1.6, BACK_Z - TUNNEL_DEPTH + 2);
tunnel.add(doorLight);
scene.add(tunnel);

// ---------------------------------------------------------------------------
// Right-wall portal — framed doorway with a triangular pediment + roundels
// ---------------------------------------------------------------------------
(function portal() {
  const px = COURT_HALF - 0.32; // just inside the right wall
  const g = new THREE.Group();

  // doorway recess
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.0),
    new THREE.MeshBasicMaterial({ color: 0x201810 }));
  door.position.set(0, 2.0, -4);
  g.add(door);
  // jambs + lintel (pilasters)
  for (const jx of [-1.2, 1.2]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.4, 0.5), stoneMat);
    jamb.position.set(jx, 2.2, -4); g.add(jamb);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.5), stoneMat);
  lintel.position.set(0, 4.5, -4); g.add(lintel);
  // triangular pediment (gable) above the door
  const ped = new THREE.Mesh(prismRoof(3.2, 1.1, 0.5), stoneMat);
  ped.rotation.y = Math.PI / 2;
  ped.position.set(0, 4.75, -4);
  g.add(ped);

  // two framed roundels further along the wall
  for (let i = 0; i < 2; i++) {
    const fz = 1.5 + i * 3.2;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.2), stoneMat);
    panel.position.set(0, 2.4, fz); g.add(panel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.16, 12, 28),
      toon({ color: PALETTE.stoneDk }));
    ring.position.set(-0.12, 2.4, fz);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }

  g.position.set(px, 0, 0);
  g.rotation.y = -Math.PI / 2; // face into the courtyard
  scene.add(g);
})();

// ---------------------------------------------------------------------------
// The bench + the philosophical egg
// ---------------------------------------------------------------------------
const EGG_POS = new THREE.Vector3(0, 1.85, 2);

const bench = new THREE.Group();
const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 1.4), woodMat);
top.position.y = 1.0; top.castShadow = top.receiveShadow = true; bench.add(top);
for (const lx of [-1.4, 1.4]) for (const lz of [-0.5, 0.5]) {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.22), woodMat);
  leg.position.set(lx, 0.5, lz); leg.castShadow = true; bench.add(leg);
}
bench.position.set(EGG_POS.x, 0, EGG_POS.z);
scene.add(bench);

const eggMat = toon({ color: PALETTE.shell, emissive: 0x3a3220, emissiveIntensity: 0.4 });
const egg = new THREE.Mesh(new THREE.SphereGeometry(0.55, 48, 48), eggMat);
egg.scale.set(1, 1.35, 1);
egg.position.copy(EGG_POS);
egg.castShadow = true;
scene.add(egg);
const eggLight = new THREE.PointLight(0xfff0cc, 1.3, 6, 2);
eggLight.position.copy(EGG_POS).setY(2.1);
scene.add(eggLight);

// ---------------------------------------------------------------------------
// The furnace at left — masonry block + flame + flicker + smoke + pilaster
// ---------------------------------------------------------------------------
const furnace = new THREE.Group();
furnace.position.set(-8.4, 0, 1);

const fbody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 2.4), brickMat);
fbody.position.y = 1.7; fbody.castShadow = fbody.receiveShadow = true; furnace.add(fbody);
const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.3),
  new THREE.MeshBasicMaterial({ color: 0x140d06 }));
mouth.position.set(0, 1.25, 1.25); furnace.add(mouth);
// tall pilaster behind furnace (left edge of the courtyard, as in the plate)
const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.7), stoneMat);
pilaster.position.set(-1.6, 4.5, 0); pilaster.castShadow = true; furnace.add(pilaster);

const flames = [];
for (let i = 0; i < 6; i++) {
  const f = new THREE.Mesh(
    new THREE.ConeGeometry(0.4 - i * 0.045, 1.2 + i * 0.28, 12),
    new THREE.MeshBasicMaterial({
      color: i < 2 ? PALETTE.ember : PALETTE.fire,
      transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  f.position.set(0, 1.4 + i * 0.2, 1.15);
  furnace.add(f); flames.push(f);
}
const fireLight = new THREE.PointLight(PALETTE.fire, 6, 18, 2);
fireLight.position.set(0, 1.7, 1.4); fireLight.castShadow = true; furnace.add(fireLight);
scene.add(furnace);

const smoke = [];
const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a2620, transparent: true, opacity: 0.16, depthWrite: false });
for (let i = 0; i < 9; i++) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), smokeMat.clone());
  s.position.set(-8.4 + (i % 3 - 1) * 0.4, 3.6 + i * 0.55, 1);
  s.userData.speed = 0.3 + (i % 3) * 0.12;
  scene.add(s); smoke.push(s);
}

// ---------------------------------------------------------------------------
// The adept — low-poly figure raising the fiery sword over the egg
// ---------------------------------------------------------------------------
const figure = new THREE.Group();
const skinMat = toon({ color: 0xc2a07e });
const tunicMat = toon({ color: 0x7a4a3a });

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.85, 4, 8), tunicMat);
torso.position.y = 1.5; torso.castShadow = true; figure.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 16), skinMat);
head.position.y = 2.28; head.castShadow = true; figure.add(head);
for (const lx of [-0.18, 0.18]) {
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.85, 4, 8), skinMat);
  leg.position.set(lx, 0.6, 0); leg.castShadow = true; figure.add(leg);
}
// left arm down (holds a small vessel, as in the plate)
const lArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.7, 4, 8), skinMat);
lArm.position.set(-0.42, 1.55, 0.05); lArm.rotation.z = 0.25; figure.add(lArm);
const vessel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.26, 10), toon({ color: 0x8a8170 }));
vessel.position.set(-0.55, 1.05, 0.1); figure.add(vessel);

// right arm + sword (animated). Pivot at the shoulder so it can swing down.
const swordArm = new THREE.Group();
swordArm.position.set(0.32, 2.0, 0.08); // shoulder pivot
const uArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.7, 4, 8), skinMat);
uArm.position.set(0.18, 0.18, 0.05); uArm.rotation.z = -0.9; uArm.castShadow = true;
swordArm.add(uArm);

const sword = new THREE.Group();
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.7, 0.14),
  toon({ color: 0xffe0ad, emissive: PALETTE.fire, emissiveIntensity: 1.6 }));
blade.position.y = 0.95; sword.add(blade);
const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.12), toon({ color: 0x3a2a18 }));
sword.add(guard);
const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35), toon({ color: 0x3a2a18 }));
hilt.position.set(0, -0.2, 0); sword.add(hilt);
sword.position.set(0.42, 0.4, 0.12);
swordArm.add(sword);
const swordLight = new THREE.PointLight(PALETTE.fire, 2.4, 8, 2);
swordLight.position.set(0.5, 1.4, 0.2); swordArm.add(swordLight);
figure.add(swordArm);

const REST_SWING = -0.15;   // resting arm rotation (sword held high)
const HIT_SWING = 1.95;     // arm rotation at the bottom of the strike
swordArm.rotation.z = REST_SWING;

figure.position.set(2.7, 0, 2);
figure.rotation.y = -0.55;
scene.add(figure);

// ---------------------------------------------------------------------------
// TOWN beyond the walls — church/spire, gabled houses, towers, trees, bird
// ---------------------------------------------------------------------------
// gable / steep roof: a triangular prism extruded along z
function prismRoof(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

const town = new THREE.Group();

function house(x, z, w, d, h, ry = 0, roofH = null, cols = 2, rows = 3, crow = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    toon({ map: makeFacadeTexture(cols, rows) }));
  body.position.y = h / 2; g.add(body);
  const rh = roofH ?? w * 0.7;
  const roof = new THREE.Mesh(prismRoof(w + 0.3, rh, d + 0.3),
    toon({ color: (x + z) % 2 ? PALETTE.roof : PALETTE.roofDk }));
  roof.position.y = h; g.add(roof);
  // crow-stepped gable accents (the stepped roofs at top-right of the plate)
  if (crow) for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, d + 0.32), toon({ color: PALETTE.stone }));
    step.position.set(-w / 2 + 0.4 + i * 0.5, h + 0.25 + i * (rh / 4), 0);
    g.add(step);
    const step2 = step.clone(); step2.position.x = w / 2 - 0.4 - i * 0.5; g.add(step2);
  }
  g.position.set(x, 0, z); g.rotation.y = ry;
  town.add(g);
  return g;
}

function roundTower(x, z, r, h) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), stoneMat);
  body.position.y = h / 2; g.add(body);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(r + 0.25, r * 2.4, 14), toon({ color: PALETTE.spire }));
  cap.position.y = h + r * 1.2; g.add(cap);
  g.position.set(x, 0, z); town.add(g);
  return g;
}

// --- the Gothic church / cathedral with a tall spire (center distance) ----
(function church() {
  const g = new THREE.Group();
  // nave
  const nave = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 13), toon({ color: 0x8d8369 }));
  nave.position.set(0, 4.5, -6); g.add(nave);
  const naveRoof = new THREE.Mesh(prismRoof(7.4, 3.2, 13), toon({ color: PALETTE.roofDk }));
  naveRoof.position.set(0, 9, -6); g.add(naveRoof);
  // west tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 15, 4.2), toon({ color: 0x968b70 }));
  tower.position.set(0, 7.5, 1); g.add(tower);
  // tall spire
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.9, 9, 4), toon({ color: PALETTE.spire }));
  spire.position.set(0, 19.5, 1); spire.rotation.y = Math.PI / 4; g.add(spire);
  // corner pinnacles
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.6, 1.6]) {
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), toon({ color: PALETTE.spire }));
    pin.position.set(sx, 16.3, 1 + sz); pin.rotation.y = Math.PI / 4; g.add(pin);
  }
  g.position.set(0, 0, -46);
  town.add(g);
})();

// --- townhouses ------------------------------------------------------------
house(-9, -42, 5, 5, 11, 0.2, 4.5, 2, 4, true);
house(8, -41, 5.5, 5, 13, -0.3, 5, 3, 4, true);
house(12, -45, 5, 5, 10, 0.1, 4, 2, 3);
house(-14, -44, 4.5, 4.5, 9, 0.4, 4, 2, 3);
// stepped-gable houses peeking over the RIGHT wall (top-right of the plate)
house(16, -2, 6, 6, 17, -Math.PI / 2, 5.5, 3, 5, true);
house(18, -10, 5.5, 6, 15, -Math.PI / 2, 5, 3, 4, true);
// a couple over the LEFT wall
house(-16, -4, 5, 5, 13, Math.PI / 2, 5, 2, 4);

roundTower(-11, -44, 1.8, 11);
roundTower(11, -42, 1.7, 12);
roundTower(20, -20, 1.9, 14);

scene.add(town);

// --- trees over the back-left wall + a bird in the sky --------------------
function tree(x, z, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 4 * scale, 8), toon({ color: 0x4a3420 }));
  trunk.position.y = 2 * scale; g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * scale, 0),
      toon({ color: i % 2 ? PALETTE.leaf : 0x47512f }));
    blob.position.set((i % 2 ? 0.7 : -0.7) * scale, (3.6 + i * 0.6) * scale, (i % 3 - 1) * 0.5 * scale);
    g.add(blob);
  }
  g.position.set(x, 0, z); scene.add(g);
}
tree(-8.5, BACK_Z - 2.5, 1.25);
tree(-10.5, BACK_Z - 3.5, 1.0);

function makeBirdSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.strokeStyle = "#23190f"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, 40); ctx.quadraticCurveTo(24, 22, 32, 36);
  ctx.quadraticCurveTo(40, 22, 56, 40);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
}
const birds = [];
for (let i = 0; i < 3; i++) {
  const b = makeBirdSprite();
  b.scale.set(2.2, 2.2, 1);
  b.position.set(-6 + i * 5, 16 + (i % 2) * 2, -30 - i * 4);
  b.userData.phase = i * 2;
  scene.add(b); birds.push(b);
}

// ---------------------------------------------------------------------------
// Reference plaque — the source engraving, framed on the entry wall
// ---------------------------------------------------------------------------
(function plaque() {
  const tex = new THREE.TextureLoader().load("assets/emblem-08.jpg");
  tex.colorSpace = THREE.SRGBColorSpace;
  const W = 5.83, H = 5.0;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, H + 0.5, 0.25), toon({ color: 0x3a2c1a }));
  frame.position.set(0, 3.4, FRONT_Z - 0.35);
  frame.rotation.y = Math.PI; // face into the courtyard (toward -z)
  scene.add(frame);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex }));
  pic.position.set(0, 3.4, FRONT_Z - 0.46);
  pic.rotation.y = Math.PI;
  scene.add(pic);
  const lamp = new THREE.PointLight(0xfff0d0, 2.2, 14, 2);
  lamp.position.set(0, 5, FRONT_Z - 4);
  scene.add(lamp);
})();

// ---------------------------------------------------------------------------
// The adjoining 17th-century laboratory (east, through the portal)
// ---------------------------------------------------------------------------
let labStageMsg = "";
const lab = buildLab({
  toon, brickMat, stoneMat, woodMat, COURT_HALF,
  STAGES: EMBLEM8.stages,
  onStage: (stage) => { labStageMsg = stage.label; },
});
scene.add(lab.group);

// ---------------------------------------------------------------------------
// First-person controls
// ---------------------------------------------------------------------------
const controls = new PointerLockControls(camera, renderer.domElement);
const overlay = document.getElementById("overlay");
const hint = document.getElementById("hint");
const reticle = document.getElementById("reticle");
const action = document.getElementById("action");
const flash = document.getElementById("flash");

let uiReading = false; // "read the emblem" mode open

overlay.addEventListener("click", () => { if (!uiReading) controls.lock(); });
controls.addEventListener("lock", () => {
  overlay.classList.add("hidden");
  hint.classList.add("show");
  reticle.classList.add("show");
});
controls.addEventListener("unlock", () => {
  hint.classList.remove("show");
  reticle.classList.remove("show");
  action.classList.remove("show");
  if (!uiReading) overlay.classList.remove("hidden"); // pause screen
});

// --- "read the emblem" guided tour: curated camera viewpoints per symbol ---
const VIEWPOINTS = {
  egg:     { pos: new THREE.Vector3(0, 2.3, 7),     look: new THREE.Vector3(0, 1.85, 2) },
  furnace: { pos: new THREE.Vector3(-3.5, 2.6, 5),  look: new THREE.Vector3(-8.4, 1.8, 1) },
  athanor: lab.focus.athanor,
  crucible: lab.focus.crucible,
};
let readTarget = null;
const readMode = makeReadMode(EMBLEM8, {
  onFocus: (key) => { readTarget = VIEWPOINTS[key] || null; },
  onOpen: () => { uiReading = true; controls.unlock(); overlay.classList.add("hidden"); hint.classList.remove("show"); },
  onClose: () => { uiReading = false; readTarget = null; overlay.classList.remove("hidden"); },
});

// --- intro cut-scene plays first; "Enter" locks the pointer ---
overlay.classList.add("hidden");
runIntro(EMBLEM8, () => controls.lock());

const keys = {};
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyR") { readMode.toggle(); return; }
  if (e.code === "Escape" && uiReading) { readMode.close(); return; }
  if (uiReading) return;
  if (e.code === "KeyF") tryHeatSword();
  if (e.code === "KeyE") { if (!tryLabAction()) tryStrike(); }
});
addEventListener("keyup", (e) => (keys[e.code] = false));

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const SPEED = 6;

const LAB_B = lab.bounds;
function clampPosition(p) {
  p.y = 1.7;
  // tunnel (behind the back arch)
  if (p.z < BACK_Z + 0.5 && p.x > -ARCH_W / 2 - 1 && p.x < ARCH_W / 2 + 1) {
    p.x = THREE.MathUtils.clamp(p.x, -ARCH_W / 2 + 0.4, ARCH_W / 2 - 0.4);
    p.z = Math.max(p.z, BACK_Z - TUNNEL_DEPTH + 1.2);
    return;
  }
  const inDoor = p.z > DOOR_Z0 && p.z < DOOR_Z1;
  if (p.x > COURT_HALF) { // laboratory
    p.x = THREE.MathUtils.clamp(p.x, COURT_HALF, LAB_B.MAXX - 0.6);
    p.z = THREE.MathUtils.clamp(p.z, LAB_B.MINZ + 0.6, LAB_B.MAXZ - 0.6);
    if (!inDoor) p.x = Math.max(p.x, COURT_HALF + 0.6);
    return;
  }
  // courtyard
  p.x = THREE.MathUtils.clamp(p.x, -COURT_HALF + 0.6, inDoor ? LAB_B.MAXX - 0.6 : COURT_HALF - 0.6);
  p.z = THREE.MathUtils.clamp(p.z, BACK_Z + 0.5, FRONT_Z - 0.8);
}

// ---------------------------------------------------------------------------
// The operation: aim at the egg + press E to strike it with the fiery sword
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
let canStrike = false;
let swordHot = false; // the blade must be heated in the fire first

// strike state machine
const strike = { active: false, t: 0, broke: false };
let shells = null, particles = null, spirit = null, spiritLight = null;

function aimsAt(objOrGroup, maxDist, recursive = false) {
  raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));
  const hit = raycaster.intersectObject(objOrGroup, recursive)[0];
  return hit && hit.distance < maxDist;
}
function aimingAtEgg() { return egg.visible && aimsAt(egg, 7); }
function aimingAtFurnace() { return aimsAt(furnace, 8, true); }

function tryHeatSword() {
  if (!controls.isLocked || strike.active || !aimingAtFurnace()) return;
  swordHot = true; // thrust into the fire — the blade glows
}

// lab interactions (context-sensitive E): returns true if it handled the press
function labInteractive() {
  if (!controls.isLocked) return null;
  raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));
  const hit = raycaster.intersectObjects(lab.interactives, false)[0];
  return hit && hit.distance < 6 ? hit.object : null;
}
function tryLabAction() {
  const obj = labInteractive();
  if (!obj) return false;
  obj.userData.action();
  return true;
}

function tryStrike() {
  if (!controls.isLocked || strike.active || !egg.visible || !canStrike || !swordHot) return;
  swordHot = false; // the heat is spent on the blow
  strike.active = true; strike.t = 0; strike.broke = false;
}

function breakEgg() {
  egg.visible = false;
  eggLight.visible = false;

  // two tumbling half-shells
  shells = new THREE.Group();
  for (const sign of [1, -1]) {
    const half = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, sign > 0 ? 0 : Math.PI / 2, Math.PI / 2),
      eggMat
    );
    half.scale.set(1, 1.35, 1);
    half.position.copy(EGG_POS);
    half.userData.vel = new THREE.Vector3(sign * 1.6, 2.2, (Math.random() - 0.5) * 1.2);
    half.userData.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, sign * 5);
    shells.add(half);
  }
  scene.add(shells);

  // fire burst
  particles = new THREE.Group();
  for (let i = 0; i < 32; i++) {
    const p = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.06 + Math.random() * 0.05),
      new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? PALETTE.fire : PALETTE.ember,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    p.position.copy(EGG_POS);
    const a = Math.random() * Math.PI * 2, up = 1 + Math.random() * 3.5;
    p.userData.vel = new THREE.Vector3(Math.cos(a) * 2.5, up, Math.sin(a) * 2.5);
    particles.add(p);
  }
  scene.add(particles);

  // the released spirit (Mercurius / anima) rises and fades
  spirit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xeafaff, transparent: true, blending: THREE.AdditiveBlending }));
  spirit.position.copy(EGG_POS);
  scene.add(spirit);
  spiritLight = new THREE.PointLight(0xbfeaff, 4, 12, 2);
  spiritLight.position.copy(EGG_POS);
  scene.add(spiritLight);

  // flash
  flash.style.opacity = "0.85";
  requestAnimationFrame(() => (flash.style.opacity = "0"));
}

function resetEgg() {
  if (shells) { scene.remove(shells); shells = null; }
  if (particles) { scene.remove(particles); particles = null; }
  if (spirit) { scene.remove(spirit); spirit = null; }
  if (spiritLight) { scene.remove(spiritLight); spiritLight = null; }
  egg.visible = true;
  eggLight.visible = true;
}

function updateStrike(dt) {
  if (!strike.active) return;
  strike.t += dt;
  const t = strike.t;

  // swing down 0 -> 0.3s, impact at 0.3, recover 0.3 -> 0.9s
  if (t < 0.3) {
    swordArm.rotation.z = THREE.MathUtils.lerp(REST_SWING, HIT_SWING, t / 0.3);
  } else if (!strike.broke) {
    swordArm.rotation.z = HIT_SWING;
    breakEgg();
    strike.broke = true;
  } else if (t < 1.0) {
    swordArm.rotation.z = THREE.MathUtils.lerp(HIT_SWING, REST_SWING, (t - 0.3) / 0.7);
  } else {
    swordArm.rotation.z = REST_SWING;
  }

  // animate debris while broken
  if (strike.broke) {
    const k = Math.min(dt, 0.05);
    if (shells) shells.children.forEach((h) => {
      h.userData.vel.y -= 9.8 * k;
      h.position.addScaledVector(h.userData.vel, k);
      h.rotation.x += h.userData.spin.x * k;
      h.rotation.z += h.userData.spin.z * k;
      if (h.position.y < 0.3) { h.position.y = 0.3; h.userData.vel.set(0, 0, 0); }
    });
    if (particles) particles.children.forEach((p) => {
      p.userData.vel.y -= 6 * k;
      p.position.addScaledVector(p.userData.vel, k);
      p.material.opacity = Math.max(0, 1 - (t - 0.3) / 1.6);
    });
    if (spirit) {
      spirit.position.y += 1.4 * k;
      const life = (t - 0.3) / 3.2;
      spirit.material.opacity = Math.max(0, 1 - life);
      spirit.scale.setScalar(1 + life * 1.5);
      if (spiritLight) spiritLight.position.copy(spirit.position),
        (spiritLight.intensity = Math.max(0, 4 * (1 - life)));
    }
  }

  if (t > 6) { strike.active = false; resetEgg(); }
}

// ---------------------------------------------------------------------------
// Post-processing: toon render + Sobel ink edges (the woodcut look)
// ---------------------------------------------------------------------------
const EdgeInkShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2() },
    inkColor: { value: new THREE.Color(PALETTE.ink) },
    strength: { value: 0.8 },
    inkMax: { value: 0.5 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform vec3 inkColor; uniform float strength; uniform float inkMax;
    varying vec2 vUv;
    float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
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
      gl_FragColor = vec4(mix(base, inkColor, ink), 1.0);
    }`,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const inkPass = new ShaderPass(EdgeInkShader);
composer.addPass(inkPass);
function updateResolution() {
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  inkPass.uniforms.resolution.value.copy(v);
}
updateResolution();

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  if (window.__PAUSE) return; // debug freeze hook
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (controls.isLocked) {
    velocity.x -= velocity.x * 10 * dt;
    velocity.z -= velocity.z * 10 * dt;
    direction.z = Number(keys.KeyW || keys.ArrowUp) - Number(keys.KeyS || keys.ArrowDown);
    direction.x = Number(keys.KeyD || keys.ArrowRight) - Number(keys.KeyA || keys.ArrowLeft);
    direction.normalize();
    if (direction.z) velocity.z -= direction.z * SPEED * 10 * dt;
    if (direction.x) velocity.x -= direction.x * SPEED * 10 * dt;
    controls.moveRight(-velocity.x * dt);
    controls.moveForward(-velocity.z * dt);
    const p = controls.getObject().position;
    p.y = 1.7;
    clampPosition(p);

    // context-sensitive interaction prompt
    let prompt = "";
    let hot = false;
    canStrike = false;
    const labObj = labInteractive();
    if (labObj) {
      prompt = labObj.userData.prompt(); hot = true;
    } else if (aimingAtFurnace()) {
      prompt = swordHot ? "The blade glows — now aim at the egg" : "Press <b>F</b> — thrust the sword into the fire";
      hot = !swordHot;
    } else if (aimingAtEgg() && !strike.active) {
      if (swordHot) { canStrike = true; hot = true; prompt = "Press <b>E</b> — " + EMBLEM8.callToAction; }
      else prompt = "The egg awaits — first heat the sword in the furnace (<b>F</b>)";
    }
    reticle.classList.toggle("hot", hot);
    action.classList.toggle("show", !!prompt);
    if (prompt) action.innerHTML = prompt;
  }

  // read-the-emblem mode: ease the camera to the focused apparatus
  if (uiReading && readTarget) {
    camera.position.lerp(readTarget.pos, 0.08);
    camera.lookAt(readTarget.look);
  }

  // furnace flames
  flames.forEach((f, i) => {
    f.scale.y = 1 + Math.sin(t * (8 + i) + i) * 0.25;
    f.scale.x = 1 + Math.cos(t * (6 + i)) * 0.12;
    f.material.opacity = 0.7 + Math.sin(t * 9 + i) * 0.2;
    f.position.x = Math.sin(t * 7 + i * 1.7) * 0.08;
  });
  fireLight.intensity = 5 + Math.sin(t * 11) * 0.9;
  // the blade only glows once heated in the fire
  swordLight.intensity = swordHot ? 2.8 + Math.sin(t * 16) * 0.6 : 0.15;
  blade.material.emissiveIntensity = swordHot ? 2.6 + Math.sin(t * 18) * 0.5 : 0.2;
  blade.material.color.setHex(swordHot ? 0xffd9a0 : 0xb9b2a0);

  // smoke
  smoke.forEach((s) => {
    s.position.y += s.userData.speed * dt;
    s.material.opacity *= 0.995;
    if (s.position.y > 9.5 || s.material.opacity < 0.02) {
      s.position.y = 3.6; s.material.opacity = 0.16;
    }
  });

  // egg breathing + door glow
  if (egg.visible) {
    const b = Math.sin(t * 1.5);
    egg.scale.set(1 + b * 0.01, 1.35 + b * 0.012, 1 + b * 0.01);
    eggLight.intensity = 1.1 + b * 0.3;
  }
  doorLight.intensity = 6 + Math.sin(t * 0.8) * 0.9;

  // birds drift
  birds.forEach((b) => {
    b.position.x += Math.sin(t * 0.3 + b.userData.phase) * dt * 0.6;
    b.position.y += Math.sin(t * 0.7 + b.userData.phase) * dt * 0.2;
  });

  updateStrike(dt);
  lab.animate(t, dt);

  composer.render();
}
animate();

addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  updateResolution();
});

// expose for debugging / verification
window.EMBLEM = {
  scene, camera, renderer, composer, strike, tryStrike,
  egg, lab, readMode,
  setSwordHot: (v) => { swordHot = v; },
  stepStrike: (dt) => updateStrike(dt), // manual frame-step (headless rAF is paused)
  stepLab: (t, dt) => lab.animate(t, dt),
};

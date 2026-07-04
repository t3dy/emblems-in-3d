import * as THREE from "three";

// ===========================================================================
// textures.js — procedural canvas textures shared across the per-emblem
// dioramas (scene.js) and the prop library (props.js), in the same spirit as
// the hand-built Emblem VIII flagship environment's checker/brick/facade
// textures (main.js) — so every plate's ground and architecture reads as a
// textured surface instead of a flat-shaded polygon, closer to a real
// materialized version of the engraving rather than a coloured diagram.
// ===========================================================================

const cache = {};
function cached(key, build) {
  if (cache[key]) return cache[key];
  const tex = build();
  cache[key] = tex;
  return tex;
}

function finish(tex, rx = 6, ry = 6) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// faint diagonal hatching over a finished canvas — the engraving's parallel
// burin strokes, kept subtle so it reads as surface tone rather than stripes
function hatch(ctx, size = 256, spacing = 7, alpha = 0.10) {
  ctx.strokeStyle = `rgba(28,20,12,${alpha})`;
  ctx.lineWidth = 1;
  for (let d = -size; d < size * 2; d += spacing) {
    ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + size, size); ctx.stroke();
  }
}

// tilled/plowed earth — dark furrow lines over a warm soil base (farms)
export function makeSoilTexture() {
  return cached("soil", () => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#6b5a34"; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 18) {
      ctx.strokeStyle = `rgba(40,30,14,${0.35 + (y % 36 === 0 ? 0.15 : 0)})`;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(${90 + Math.random() * 30},${70 + Math.random() * 25},${40 + Math.random() * 15},0.5)`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    hatch(ctx);
    return finish(new THREE.CanvasTexture(c), 8, 8);
  });
}

// grass — mottled green with fine blade strokes (gardens, hillsides)
export function makeGrassTexture() {
  return cached("grass", () => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#596b45"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      ctx.strokeStyle = `hsl(${85 + Math.random() * 25},${30 + Math.random() * 15}%,${28 + Math.random() * 14}%)`;
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 4); ctx.stroke();
    }
    hatch(ctx);
    return finish(new THREE.CanvasTexture(c), 10, 10);
  });
}

// flagstone / cobblestone — irregular polygon floor (courtyards, castles)
export function makeCobbleTexture() {
  return cached("cobble", () => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#4d463a"; ctx.fillRect(0, 0, 256, 256);
    const cell = 32;
    for (let y = 0; y < 256; y += cell)
      for (let x = 0; x < 256; x += cell) {
        const jx = x + (Math.random() - 0.5) * 6, jy = y + (Math.random() - 0.5) * 6;
        const shade = 55 + Math.random() * 18;
        ctx.fillStyle = `hsl(38,14%,${shade}%)`;
        ctx.fillRect(jx + 2, jy + 2, cell - 4, cell - 4);
        ctx.strokeStyle = "rgba(20,16,10,0.55)"; ctx.lineWidth = 2; ctx.strokeRect(jx + 2, jy + 2, cell - 4, cell - 4);
      }
    hatch(ctx);
    return finish(new THREE.CanvasTexture(c), 7, 7);
  });
}

// wood planking — for kitchens, cottages, library floors
export function makeWoodFloorTexture() {
  return cached("woodfloor", () => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#5c4530"; ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = `hsl(28,32%,${24 + ((x / 32) % 3) * 5}%)`;
      ctx.fillRect(x, 0, 30, 256);
      for (let y = 0; y < 256; y += 40) { ctx.strokeStyle = "rgba(20,14,8,0.4)"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30, y); ctx.stroke(); }
    }
    hatch(ctx);
    return finish(new THREE.CanvasTexture(c), 5, 8);
  });
}

// beach sand — fine mottled tan (seaside)
export function makeSandTexture() {
  return cached("sand", () => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#c9b585"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1200; i++) { ctx.fillStyle = `rgba(${150 + Math.random() * 60},${130 + Math.random() * 50},${90 + Math.random() * 40},0.5)`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
    hatch(ctx, 256, 7, 0.06);
    return finish(new THREE.CanvasTexture(c), 9, 9);
  });
}

// stone/brick facade for buildings, castles, columns — rows of coursed
// masonry with darker mortar lines, closer to the engraving's crosshatched
// stonework than a flat-colour box.
export function makeStoneFacadeTexture(base = "#8c7c5c") {
  return cached("stone-" + base, () => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    const bw = 44, bh = 20;
    for (let row = 0, y = 0; y < 256; y += bh, row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < 256; x += bw) {
        ctx.fillStyle = `hsl(38,18%,${38 + ((x * 7 + row * 13) % 14)}%)`;
        ctx.fillRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
    hatch(ctx, 256, 6, 0.12);
    return finish(new THREE.CanvasTexture(c), 3, 3);
  });
}

// a soft radial parchment-to-mood gradient for the scene background, so the
// void behind each diorama reads as toned paper fading into the alchemical
// stage colour rather than a single flat fill.
export function makeSkyGradient(moodHex) {
  const key = "sky-" + moodHex;
  return cached(key, () => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const ctx = c.getContext("2d");
    const mood = new THREE.Color(moodHex);
    const paper = mood.clone().lerp(new THREE.Color(0xe9dcc0), 0.45);
    const grad = ctx.createRadialGradient(256, 190, 40, 256, 256, 380);
    grad.addColorStop(0, `rgb(${paper.r * 255},${paper.g * 255},${paper.b * 255})`);
    grad.addColorStop(1, `rgb(${mood.r * 255},${mood.g * 255},${mood.b * 255})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

// tiled/checker paving in the emblem's own accent colour — the same
// "signature checkerboard" look as the Emblem VIII flagship floor, tinted
// per-plate so it still reads as that emblem's colour world.
export function makeCheckerTexture(hex = 0x8a8270, squares = 8) {
  return cached("checker-" + hex, () => {
    const base = new THREE.Color(hex);
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const ctx = c.getContext("2d");
    const s = 256 / squares;
    for (let y = 0; y < squares; y++)
      for (let x = 0; x < squares; x++) {
        const light = (x + y) % 2 === 0;
        const col = base.clone().multiplyScalar(light ? 1.15 : 0.85);
        ctx.fillStyle = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
        ctx.fillRect(x * s, y * s, s, s);
        ctx.strokeStyle = "rgba(40,32,20,0.35)"; ctx.lineWidth = 2; ctx.strokeRect(x * s, y * s, s, s);
      }
    hatch(ctx);
    return finish(new THREE.CanvasTexture(c), 6, 6);
  });
}

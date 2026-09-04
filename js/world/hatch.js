import * as THREE from "three";

// ===========================================================================
// hatch.js — the world's only material for BUILT geometry.
//
// PROPOSAL_PHASE6.md §3: the one built object in Phase 5 (Emblem VIII's vault)
// is the one object that looks wrong, because it is a shaded polygon standing
// next to a 1617 engraving. The fix is Praun/Hoppe/Webb/Finkelstein's
// *Real-Time Hatching*: a tonal art map — a set of hatch images indexed by
// tone, blended per fragment — which gives spatial and temporal coherence for
// free, unlike a screen-space post filter.
//
// The corpus-specific part, and the reason this is a reconstruction rather
// than a style filter: **the six tiles are cut out of Merian's own plates.**
// tools/build_hatch_tam.py scans every 256 px window of all 51 engravings,
// measures its ink fraction (tone) and its structure-tensor coherence (how
// purely it is parallel burin work), and keeps the most coherent passage in
// each of six tone bins. site/assets/hatch/tam.json records which plate and
// which pixel window each tile came from.
//
// So a wall in this world is shaded with strokes Merian actually cut, at the
// density his hand used for that darkness. Built and drawn geometry become
// the same substance — which is the whole point.
//
// Mapping is TRIPLANAR in world space. That costs three sets of samples but
// it means procedural geometry needs no UVs at all, and the hatch stays
// welded to the world instead of swimming when you walk.
// ===========================================================================

export const TAM_TILES = 6;

const VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uTam;      // 6 tiles in one horizontal strip, light -> dark
uniform float uTiles;
uniform vec3  uLightDir;     // world space, points FROM the light
uniform vec3  uPaper;        // the untouched sheet
uniform vec3  uInk;          // the bitten line
uniform vec3  uTint;         // stage tint, multiplied over the paper
uniform float uScale;        // hatch periods per metre
uniform float uAmbient;
uniform float uContrast;
uniform float uFlat;         // 1.0 = ignore lighting, use uFlatTone
uniform float uFlatTone;
uniform float uFade;         // 0..1 aerial fade toward paper with distance
uniform float uFogNear;
uniform float uFogFar;
uniform vec3  uFogColor;
uniform float uDebugTone;    // 1.0 = output the tone field, not the hatching

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// One tile of the strip, with a half-texel inset so neighbouring tiles never
// bleed across the seam under mip filtering.
vec3 tamTile(vec2 uv, float idx) {
  float w = 1.0 / uTiles;
  vec2 f = fract(uv);
  float inset = 0.5 / (256.0 * uTiles);
  float u = (idx + clamp(f.x, 0.0, 1.0)) * w;
  u = clamp(u, idx * w + inset, (idx + 1.0) * w - inset);
  return texture2D(uTam, vec2(u, f.y)).rgb;
}

// Blend the two tiles that bracket this tone, exactly as a TAM should.
float hatchAt(vec2 uv, float tone) {
  float t = clamp(tone, 0.0, 1.0) * (uTiles - 1.0);
  float i = floor(t);
  float frac = t - i;
  float a = tamTile(uv, i).r;
  float b = tamTile(uv, min(i + 1.0, uTiles - 1.0)).r;
  return mix(a, b, frac);
}

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 an = abs(n);
  an = pow(an, vec3(4.0));
  an /= max(an.x + an.y + an.z, 1e-4);

  vec2 uvX = vWorldPos.zy * uScale;
  vec2 uvY = vWorldPos.xz * uScale;
  vec2 uvZ = vWorldPos.xy * uScale;

  float lambert = max(dot(n, -normalize(uLightDir)), 0.0);
  float lit = uAmbient + (1.0 - uAmbient) * lambert;
  float tone = mix(clamp((1.0 - lit) * uContrast, 0.0, 1.0), uFlatTone, uFlat);

  if (uDebugTone > 0.5) {
    gl_FragColor = vec4(vec3(1.0 - tone), 1.0);
    return;
  }

  float h =
      hatchAt(uvX, tone) * an.x +
      hatchAt(uvY, tone) * an.y +
      hatchAt(uvZ, tone) * an.z;

  vec3 col = mix(uInk, uPaper * uTint, clamp(h, 0.0, 1.0));

  // aerial perspective: the sheet whitens with distance, the way a plate's
  // far ground does when the burin lifts.
  float d = length(vWorldPos - cameraPosition);
  float fog = clamp((d - uFogNear) / max(uFogFar - uFogNear, 1e-3), 0.0, 1.0);
  col = mix(col, uFogColor, fog * uFade);

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Load the TAM strip. Nearest on the tile axis is wrong — we want linear
 *  inside a tile — so filtering is linear and the inset above guards seams. */
export function loadTam(url = "assets/hatch/tam.png") {
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  return tex;
}

/**
 * @param {object} o
 * @param {THREE.Texture} o.tam
 * @param {number} [o.scale]     hatch periods per metre
 * @param {number} [o.contrast]  how hard the tone ramp bites
 * @param {number} [o.flat]      1 = unlit, use flatTone (for skies, cartouches)
 */
export function makeHatchMaterial({
  tam,
  scale = 0.55,
  contrast = 1.15,
  ambient = 0.34,
  flat = 0,
  flatTone = 0.2,
  paper = 0xf1ebda,
  ink = 0x1a1510,
  tint = 0xffffff,
  fade = 1.0,
  side = THREE.FrontSide,
} = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side,
    uniforms: {
      uTam: { value: tam },
      uTiles: { value: TAM_TILES },
      uLightDir: { value: new THREE.Vector3(-0.42, -0.78, -0.46).normalize() },
      uPaper: { value: new THREE.Color(paper) },
      uInk: { value: new THREE.Color(ink) },
      uTint: { value: new THREE.Color(tint) },
      uScale: { value: scale },
      uAmbient: { value: ambient },
      uContrast: { value: contrast },
      uFlat: { value: flat },
      uFlatTone: { value: flatTone },
      uFade: { value: fade },
      uFogNear: { value: 30 },
      uFogFar: { value: 260 },
      uFogColor: { value: new THREE.Color(0xe8e0cd) },
      uDebugTone: { value: 0 },
    },
  });
  mat.userData.isHatch = true;
  return mat;
}

/** Every hatch material in the world shares the same light, fog and stage
 *  tint. Registering them here keeps that a single write per frame instead of
 *  a scene traversal. */
export class HatchRegistry {
  constructor() {
    this.materials = [];
  }
  add(mat) {
    if (mat && mat.userData && mat.userData.isHatch) this.materials.push(mat);
    return mat;
  }
  setTint(color) {
    for (const m of this.materials) m.uniforms.uTint.value.copy(color);
  }
  setFog(color, near, far) {
    for (const m of this.materials) {
      m.uniforms.uFogColor.value.copy(color);
      m.uniforms.uFogNear.value = near;
      m.uniforms.uFogFar.value = far;
    }
  }
  setLightDir(v) {
    for (const m of this.materials) m.uniforms.uLightDir.value.copy(v);
  }
  setDebugTone(on) {
    for (const m of this.materials) m.uniforms.uDebugTone.value = on ? 1 : 0;
  }
}

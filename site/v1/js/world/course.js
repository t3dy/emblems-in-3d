import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng } from "./settings.js";

// ===========================================================================
// course.js — the connective tissue, and the only invented thing in the world.
//
// The book IS a race: Hippomenes chases Atalanta, the reader chases fleeting
// truths, and the fifty fugues are all canons of pursuit. So the world is a
// course, walked in emblem order from the title page to Emblem L, and not a
// museum with a lobby. Everything on this side of a station's arch is
// invented connective tissue and is meant to read that way; everything past
// the arch is measured, or is labelled conjecture.
//
// The stage gradient. NIGREDO -> ALBEDO -> CITRINITAS -> RUBEDO is not
// monotonic in emblem order (III is albedo, IV-V fall back to nigredo, X is
// citrinitas, XI-XIII albedo again; rubedo only runs clean from XXVII). So
// rather than reorder the book or lie about a clean partition, ground tint,
// sky and fog LERP along the road toward whatever stage each station actually
// carries. Walking the course therefore feels the oscillation the book has.
// ===========================================================================

// The stage tints multiply the paper, so they must stay high-key: an engraving
// is ink on a light sheet even at its blackest, and a NIGREDO that reads as
// night stops reading as a print.
const STAGE_TINT = {
  NIGREDO: 0xc3bbad,
  ALBEDO: 0xf7f3e9,
  CITRINITAS: 0xeedfab,
  RUBEDO: 0xe3b79c,
};
const STAGE_SKY = {
  NIGREDO: 0x9a938a,
  ALBEDO: 0xeee9dc,
  CITRINITAS: 0xe2d09a,
  RUBEDO: 0xd3a184,
};

function skyGradient() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.0, "#b9b1a0");
  grd.addColorStop(0.45, "#e9e2d1");
  grd.addColorStop(0.62, "#f3ecdc");
  grd.addColorStop(1.0, "#d8d0bd");
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Course {
  /**
   * @param {object} world  parsed world.json
   * @param {object} materials  the hatch material set
   */
  constructor(world, materials) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = "course";

    const pts = world.route.map((k) => {
      const [x, , z] = world.stations[k].world.road;
      return new THREE.Vector3(x, 0, z);
    });
    // extend a little past both ends so the road does not stop at the first
    // and last cartouche
    const first = pts[0].clone().add(new THREE.Vector3(0, 0, 34));
    const last = pts[pts.length - 1].clone().add(new THREE.Vector3(0, 0, -34));
    this.curve = new THREE.CatmullRomCurve3([first, ...pts, last], false, "catmullrom", 0.5);
    this.stops = pts;

    this._buildGround(materials);
    this._buildRoad(materials);
    this._buildHorizon(materials);
    this._buildSky();

    // the stage of each station, in road order, for the gradient
    this._stageAt = world.route.map((k) => world.stations[k].stage || "NIGREDO");
    this._zAt = pts.map((p) => p.z);
  }

  _buildGround(M) {
    const minZ = Math.min(...this.stops.map((p) => p.z)) - 70;
    const maxZ = Math.max(...this.stops.map((p) => p.z)) + 70;
    const w = 420, d = maxZ - minZ;
    const g = new THREE.PlaneGeometry(w, d, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, (minZ + maxZ) / 2);
    g.deleteAttribute("uv");
    const mesh = new THREE.Mesh(g, M.green);
    mesh.name = "ground";
    mesh.receiveShadow = true;
    this.ground = mesh;
    this.group.add(mesh);
    this.bounds = { minX: -w / 2 + 6, maxX: w / 2 - 6, minZ: minZ + 6, maxZ: maxZ - 6 };
  }

  _buildRoad(M) {
    const half = this.world.road.half_width_m;
    const n = 900;
    const pos = [];
    const idx = [];
    const up = new THREE.Vector3(0, 1, 0);
    const t = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = this.curve.getPointAt(u);
      this.curve.getTangentAt(u, t);
      const side = new THREE.Vector3().crossVectors(t, up).normalize().multiplyScalar(half);
      pos.push(p.x - side.x, 0.035, p.z - side.z);
      pos.push(p.x + side.x, 0.035, p.z + side.z);
      if (i < n) {
        // Wind counter-clockwise seen from above. The obvious ordering here
        // faces the strip DOWNWARD, and with a FrontSide material the road
        // then renders as nothing at all.
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, M.road || M.stone);
    mesh.name = "road";
    mesh.receiveShadow = true;
    this.road = mesh;
    this.group.add(mesh);

    // Verge stones. Without them the road is a band of the same tone as the
    // field and the course is invisible, which defeats the whole conceit: the
    // book is a race and you are meant to be able to see the track.
    const stones = [];
    const r = rng(20250904);
    for (let i = 0; i <= 260; i++) {
      const u = i / 260;
      const p = this.curve.getPointAt(u);
      this.curve.getTangentAt(u, t);
      const side = new THREE.Vector3().crossVectors(t, up).normalize();
      for (const sgn of [-1, 1]) {
        const w = 0.24 + r() * 0.16, h = 0.26 + r() * 0.22;
        const gx = new THREE.BoxGeometry(w, h, w * 1.4);
        gx.rotateY(r() * 0.7 - 0.35);
        gx.translate(
          p.x + side.x * sgn * (half + 0.35),
          h / 2,
          p.z + side.z * sgn * (half + 0.35)
        );
        gx.deleteAttribute("uv");
        stones.push(gx);
      }
    }
    const verge = new THREE.Mesh(mergeGeometries(stones, false), M.stone);
    verge.name = "verge";
    this.group.add(verge);
    stones.forEach((g2) => g2.dispose());

    // Ground tufts either side of the road, so the field is not a bare plane.
    const tufts = [];
    for (let i = 0; i <= 620; i++) {
      const u = i / 620;
      const p = this.curve.getPointAt(u);
      for (let k = 0; k < 3; k++) {
        const off = (r() * 2 - 1) * 26;
        if (Math.abs(off) < half + 1.2) continue;
        const hgt = 0.24 + r() * 0.5;
        const gx = new THREE.ConeGeometry(0.16 + r() * 0.14, hgt, 4, 1);
        gx.rotateY(r() * 3.14);
        gx.translate(p.x + off, hgt / 2, p.z + (r() * 2 - 1) * 11);
        gx.deleteAttribute("uv");
        tufts.push(gx);
      }
    }
    const tuft = new THREE.Mesh(mergeGeometries(tufts, false), M.green);
    tuft.name = "tufts";
    this.group.add(tuft);
    tufts.forEach((g2) => g2.dispose());
  }

  /** A ring of distant hills so the course has a world beyond its verges.
   *  Deterministic: one seed for the whole horizon. */
  _buildHorizon(M) {
    const r = rng(1617);
    const parts = [];
    const minZ = this.bounds.minZ, maxZ = this.bounds.maxZ;
    for (let z = minZ; z < maxZ; z += 46) {
      for (const s of [-1, 1]) {
        const x = s * (140 + r() * 60);
        const rad = 26 + r() * 40;
        const h = 10 + r() * 26;
        const g = new THREE.SphereGeometry(rad, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(1, h / rad, 0.7 + r() * 0.5);
        g.translate(x, -2, z + (r() - 0.5) * 30);
        g.deleteAttribute("uv");
        parts.push(g);
      }
    }
    const merged = mergeGeometries(parts, false);
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, M.green);
    mesh.name = "horizon";
    this.group.add(mesh);
    parts.forEach((g) => g.dispose());
  }

  _buildSky() {
    const g = new THREE.SphereGeometry(900, 24, 16);
    const mat = new THREE.MeshBasicMaterial({
      map: skyGradient(), side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = "sky";
    mesh.renderOrder = -1;
    this.sky = mesh;
    this.skyMat = mat;
    this.group.add(mesh);
  }

  /** Which two stations bracket this z, and how far between them we are. */
  _bracket(z) {
    const zs = this._zAt;
    if (z >= zs[0]) return [0, 0, 0];
    for (let i = 0; i < zs.length - 1; i++) {
      if (z <= zs[i] && z >= zs[i + 1]) {
        const t = (zs[i] - z) / Math.max(1e-3, zs[i] - zs[i + 1]);
        return [i, i + 1, t];
      }
    }
    return [zs.length - 1, zs.length - 1, 0];
  }

  /** The stage colour where the walker is standing. */
  tintAt(z, out = new THREE.Color()) {
    const [a, b, t] = this._bracket(z);
    const ca = new THREE.Color(STAGE_TINT[this._stageAt[a]] ?? 0xffffff);
    const cb = new THREE.Color(STAGE_TINT[this._stageAt[b]] ?? 0xffffff);
    return out.copy(ca).lerp(cb, t);
  }

  skyAt(z, out = new THREE.Color()) {
    const [a, b, t] = this._bracket(z);
    const ca = new THREE.Color(STAGE_SKY[this._stageAt[a]] ?? 0xffffff);
    const cb = new THREE.Color(STAGE_SKY[this._stageAt[b]] ?? 0xffffff);
    return out.copy(ca).lerp(cb, t);
  }

  stageAt(z) {
    const [a, b, t] = this._bracket(z);
    return t < 0.5 ? this._stageAt[a] : this._stageAt[b];
  }

  /** Nearest station index to a world position, and its distance. */
  nearest(p) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.stops.length; i++) {
      const d = this.stops[i].distanceToSquared(p);
      if (d < bd) { bd = d; best = i; }
    }
    return { index: best, distance: Math.sqrt(bd) };
  }
}

export { STAGE_TINT, STAGE_SKY };

import * as THREE from "three";
import { planSetting, compileSetting } from "./settings.js";

// ===========================================================================
// station.js — one emblem's place on the course.
//
// A station is three things stacked in one local frame whose origin is ON THE
// GROUND at the station point, +Y up, -Z into the picture:
//
//   1. the setting      generated architecture/landscape for the archetype
//                       locations.js reads off Maier's own epigram
//   2. the threshold    an arch and a cartouche carrying the number and motto.
//                       It is not decoration: it is the visible boundary
//                       between the invented connective world OUTSIDE it and
//                       the reconstruction INSIDE it. Everything past the arch
//                       is measured or is labelled conjecture.
//   3. the diorama      the plate itself, in one of two tiers
//
// TIER "measured" (5 plates). Depths from the plate's own pinhole:
//     Z = f·E/(y − horizon),  size = px·Z/f
//   so from the station point the reconstruction reprojects onto the plate.
//   Standing at local (0, eye, 0) with the camera set to that plate's f is the
//   reprojection gate, now available inside the world rather than only on a
//   single-plate page.
//
// TIER "conjectural" (46 plates). The armature router found no recoverable
//   horizon, so there is no honest depth to give. The plate stands as a cut
//   sheet and its cutouts pop forward in PARALLEL projection: apparent size
//   never changes, so the reconstruction claims nothing about depth. The
//   difference is visible in the world — a measured plate is a room you walk
//   into, a conjectural plate is a flat you walk past — which is the point.
//
// Textures stream. 51 plates at full size is ~250 MB of GPU memory, so a
// station builds its geometry immediately and loads its images only when the
// walker is near.
// ===========================================================================

const PLATE_LOADER = new THREE.TextureLoader();
const _cache = new Map();

function loadTexture(url) {
  if (_cache.has(url)) {
    const e = _cache.get(url);
    e.refs++;
    return e.tex;
  }
  const tex = PLATE_LOADER.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _cache.set(url, { tex, refs: 1 });
  return tex;
}

function releaseTexture(url) {
  const e = _cache.get(url);
  if (!e) return;
  if (--e.refs <= 0) {
    e.tex.dispose();
    _cache.delete(url);
  }
}

/** A 1-bit-looking letterpress panel drawn to canvas. Used for the cartouche
 *  and the floor plaque so the world's own labels are of the book, not of a
 *  UI kit. */
function letterpress(lines, { w = 1024, h = 256, pad = 26 } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#e7dfcb";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#241d16";
  g.lineWidth = 4;
  g.strokeRect(pad * 0.5, pad * 0.5, w - pad, h - pad);
  g.strokeRect(pad * 0.5 + 8, pad * 0.5 + 8, w - pad - 16, h - pad - 16);
  g.fillStyle = "#241d16";
  g.textAlign = "center";
  let y = pad + 18;
  for (const [text, size, style] of lines) {
    g.font = `${style || ""} ${size}px "Iowan Old Style", "Palatino Linotype", Georgia, serif`;
    y += size;
    g.fillText(text, w / 2, y, w - pad * 3);
    y += size * 0.28;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function fitText(s, n) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

// ---------------------------------------------------------------------------

export class Station {
  /**
   * @param {object} st   one entry of world.json .stations
   * @param {object} ctx  { materials, hatchRegistry, assetBase }
   */
  constructor(st, ctx) {
    this.st = st;
    this.ctx = ctx;
    this.tier = st.geometry.tier;
    this.loaded = false;
    this.textures = [];

    const g = new THREE.Group();
    g.name = st.key;
    const [x, , z] = st.world.road;
    const side = st.world.bay_side;
    const heading = THREE.MathUtils.degToRad(st.world.heading_deg);

    // Bays alternate sides of the road, set back and turned to face it.
    const off = st.world.bay_offset_m;
    g.position.set(x + Math.cos(heading) * off * side, 0, z - Math.sin(heading) * off * side);
    g.rotation.y = heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    this.group = g;

    this.eye = this.tier === "measured" ? st.plate.eye_height_m : 1.62;

    // Order matters. The diorama is built first because its depth decides
    // where the setting is allowed to stand: a MEASURED plate's space can run
    // 25 m back, and the invented architecture must never intrude into it.
    // Where we have solved a plate's space we show that space, not ours.
    this.diorama = new THREE.Group();
    this.diorama.name = "diorama";
    g.add(this.diorama);
    this._buildPlaceholders();
    this._buildSetting();
    this._buildThreshold();
  }

  // -- the place -----------------------------------------------------------
  _buildSetting() {
    const plan = planSetting(this.st.setting, this.st.n + 1);
    this.plan = plan;
    const grp = compileSetting(plan, this.ctx.materials);
    // The setting's back range sits at local z = -8.5. For a conjectural
    // station the cut sheet stands at -3.4, comfortably in front of it, so the
    // flat reads as standing IN a place. For a measured station the
    // reconstruction is metres deep, so the whole shell is pushed behind the
    // backdrop: from the station point you then see only the plate's own
    // space, and the setting is what you see walking past.
    // The rule in both tiers is the same: no invented prop may stand between
    // the viewer and the reconstruction. Only the BACK zone — the ranges,
    // roofs and on-axis masses — is pushed beyond the diorama's front plane;
    // the FLANK zone is narrow and lateral, outside the view cone, and stays
    // where it was planned so the bay is still framed by its place.
    const shift = -(this.backdropSpec.z + (this.tier === "measured" ? 6 : 4.5));
    if (grp.userData.zones) grp.userData.zones.back.position.z = shift;
    else grp.position.z = shift;
    this.group.add(grp);
    this.settingGroup = grp;
    this.diagnostics = grp.userData.diagnostics;
  }

  // -- the boundary --------------------------------------------------------
  _buildThreshold() {
    const st = this.st;
    const M = this.ctx.materials;
    // The arch stands between the road and the station point, so you pass
    // under it on the way in. It is the visible boundary between the invented
    // world and the reconstruction.
    const W = 6.4, H = 5.2, T = 0.5, PIER = 0.7, Z = 5.4;
    const parts = new THREE.Group();
    parts.name = "threshold";

    const pier = (sx) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(PIER, H, T), M.stone);
      m.position.set(sx * (W / 2 - PIER / 2), H / 2, Z);
      m.castShadow = true;
      return m;
    };
    parts.add(pier(-1), pier(1));

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.62, T + 0.24), M.stone);
    lintel.position.set(0, H + 0.31, Z);
    lintel.castShadow = true;
    parts.add(lintel);

    // the cartouche: number, motto, and the tier, stated
    const roman = st.roman ? `EMBLEMA ${st.roman}` : "TITULUS";
    const tex = letterpress([
      [roman, 46, "bold"],
      [fitText(st.motto?.la || st.motto?.en || "", 58), 34, "italic"],
      [fitText(st.motto?.en || "", 62), 28, ""],
      [this.tier === "measured" ? "solved · walk to the station point" : "no horizon recoverable · a cut sheet", 22, ""],
    ], { w: 1024, h: 300 });
    this.textures.push(tex);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 0.4, (W + 0.4) * 300 / 1024),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    board.position.set(0, H + 1.05, Z + 0.28);
    parts.add(board);

    // the station point, marked on the ground
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20),
      new THREE.MeshBasicMaterial({
        color: this.tier === "measured" ? 0x8a6a2a : 0x6a6055,
        transparent: true, opacity: 0.85,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.02, 0);
    parts.add(disc);

    this.group.add(parts);
  }

  // -- the diorama ---------------------------------------------------------
  _buildPlaceholders() {
    // Geometry now, pixels later. A station holds its shape in the world even
    // when its plate has been streamed out, so the course never has holes.
    const st = this.st;
    this.cards = [];

    const mat = () => new THREE.MeshBasicMaterial({
      color: 0xded5c0, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
    });

    if (this.tier === "measured") {
      const p = st.plate;
      const zBack = Math.max(
        14,
        (st.geometry.cards.reduce((m, c) => Math.max(m, c.z_m), 0) || 10) * 1.25
      );
      const bw = (p.w * zBack) / p.focal_px;
      const bh = (p.h * zBack) / p.focal_px;
      const by = p.eye_height_m - ((p.h / 2 - p.horizon_y) * zBack) / p.focal_px;
      const back = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat());
      back.position.set(0, by, -zBack);
      back.name = "backdrop";
      this.backdrop = back;
      this.diorama.add(back);
      this.backdropSpec = { w: bw, h: bh, y: by, z: zBack };

      for (const c of st.geometry.cards) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(c.w_m, c.h_m), mat());
        m.position.set(c.x_m, c.y_bottom_m + c.h_m / 2, -c.z_m);
        m.name = c.label;
        m.userData.card = c;
        this.diorama.add(m);
        this.cards.push(m);
      }
    } else {
      const s = st.geometry.sheet;
      const back = new THREE.Mesh(new THREE.PlaneGeometry(s.w_m, s.h_m), mat());
      back.position.set(0, s.h_m / 2, -s.depth_m);
      back.name = "sheet";
      this.backdrop = back;
      this.diorama.add(back);
      this.backdropSpec = { w: s.w_m, h: s.h_m, y: s.h_m / 2, z: s.depth_m };

      for (const c of st.geometry.cards) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(c.w_m, c.h_m), mat());
        m.position.set(c.x_m, c.y_center_m, -s.depth_m + c.pop_m);
        m.name = c.label;
        m.userData.card = c;
        this.diorama.add(m);
        this.cards.push(m);
      }
    }
  }

  /** A measured station's backdrop is the plate at 20+ m, so it is 12 m tall
   *  and reads as a billboard from the road. Show the reconstruction only from
   *  inside the bay; from outside you see the setting, which is the point. */
  setViewerDistance(d) {
    const near = this.tier === "measured" ? 46 : 34;
    const want = d < near;
    if (this.diorama.visible !== want) this.diorama.visible = want;
  }

  // -- streaming -----------------------------------------------------------
  load() {
    if (this.loaded) return;
    this.loaded = true;
    const base = this.ctx.assetBase;
    const st = this.st;

    const plateUrl = `${base}/${st.plate.file}`;
    this._plateUrl = plateUrl;
    const plateTex = loadTexture(plateUrl);
    this.backdrop.material.dispose();
    this.backdrop.material = new THREE.MeshBasicMaterial({
      map: plateTex, side: THREE.DoubleSide,
    });

    this._cardUrls = [];
    for (const m of this.cards) {
      const url = `${base}/cutouts/${m.userData.card.file}`;
      this._cardUrls.push(url);
      const t = loadTexture(url);
      m.material.dispose();
      m.material = new THREE.MeshBasicMaterial({
        map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
        depthWrite: true,
      });
    }
  }

  unload() {
    if (!this.loaded) return;
    this.loaded = false;
    const flat = new THREE.MeshBasicMaterial({
      color: 0xded5c0, transparent: true, opacity: 0.92, side: THREE.DoubleSide,
    });
    this.backdrop.material.dispose();
    this.backdrop.material = flat;
    for (const m of this.cards) {
      m.material.dispose();
      m.material = flat;
    }
    if (this._plateUrl) releaseTexture(this._plateUrl);
    (this._cardUrls || []).forEach(releaseTexture);
    this._plateUrl = null;
    this._cardUrls = [];
  }

  /** Where a viewer stands to see this station as its plate was drawn. */
  viewPose() {
    const pos = new THREE.Vector3(0, this.eye, 0);
    const look = new THREE.Vector3(0, this.eye, -6);
    this.group.localToWorld(pos);
    this.group.localToWorld(look);
    return { pos, look };
  }

  /** Vertical field of view that reproduces this plate, or null if the plate
   *  never gave us one. Owning the projection is the whole reason the gate is
   *  a test. */
  plateFov() {
    const p = this.st.plate;
    if (!p.horizon_recoverable || !p.focal_px) return null;
    return 2 * Math.atan(p.h / (2 * p.focal_px)) * (180 / Math.PI);
  }

  /** Open the book: 0 collapses the pop, 1 is the full reconstruction. */
  setPop(t) {
    for (const m of this.cards) {
      const c = m.userData.card;
      if (this.tier === "measured") {
        const zBack = this.backdropSpec.z;
        m.position.z = -THREE.MathUtils.lerp(zBack, c.z_m, t);
        const s = THREE.MathUtils.lerp(zBack / c.z_m, 1, t);
        m.scale.setScalar(s);
      } else {
        m.position.z = -this.backdropSpec.z + c.pop_m * t;
      }
    }
  }
}

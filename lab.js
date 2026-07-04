import * as THREE from "three";

// ===========================================================================
// lab.js — a 17th-century "chymical" laboratory adjoining the courtyard
// (east, through the right-wall portal). Period apparatus modelled from the
// research: athanor (self-feeding tower furnace), reverberatory & distillation
// furnaces, cucurbit + alembic + receiver, pelican, retort, aludel, balneum
// mariae, Hessian crucible, bronze mortar, work table, shelves of glassware.
//
// Two playable operations:
//   - digestStep(): advance the philosophical egg through the colour sequence
//     (prima -> nigredo -> albedo -> citrinitas -> rubedo)  [digestion]
//   - fuseRegulus(): fuse stibnite + iron in the crucible -> star regulus of
//     antimony ("Mars assists Vulcan")                      [fusion]
// ===========================================================================

export function buildLab(ctx) {
  const { toon, brickMat, stoneMat, woodMat, STAGES, onStage } = ctx;

  // region (world coords); west edge is the shared courtyard right wall (x=11)
  const MINX = ctx.COURT_HALF, MAXX = 27, MINZ = -16, MAXZ = 6, H = 9;
  const group = new THREE.Group();

  // ----- materials -----
  const glass = new THREE.MeshStandardMaterial({
    color: 0xcfe3da, transparent: true, opacity: 0.34,
    roughness: 0.07, metalness: 0.0, side: THREE.DoubleSide,
  });
  const ceramic = toon({ color: 0x9a8466 });
  const copper = toon({ color: 0x9a5a30 });
  const bronze = toon({ color: 0x7d6a3a });
  const iron = toon({ color: 0x3a3630 });
  const flagstone = toon({ color: 0x6c6450 });

  const add = (mesh, x, y, z, p = group) => { mesh.position.set(x, y, z); p.add(mesh); return mesh; };
  const M = (geo, mat) => new THREE.Mesh(geo, mat);

  const flames = [];   // {mesh} additive cones
  const lights = [];   // flickering point lights
  const vapors = [];   // rising translucent wisps

  function flame(x, y, z, scale = 1, color = 0xff7a1a) {
    const f = M(new THREE.ConeGeometry(0.22 * scale, 0.7 * scale, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    add(f, x, y, z); flames.push(f); return f;
  }
  function emberLight(x, y, z, color = 0xff7a1a, intensity = 3, dist = 9) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    add(l, x, y, z); l.userData.base = intensity; lights.push(l); return l;
  }
  function vapor(x, y, z) {
    const s = M(new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xd8d2c4, transparent: true, opacity: 0.14, depthWrite: false }));
    add(s, x, y, z); s.userData = { x0: x, z0: z, y0: y, speed: 0.4 + Math.random() * 0.4 };
    vapors.push(s); return s;
  }

  // ----- shell of the room -----
  add(M(new THREE.PlaneGeometry(MAXX - MINX, MAXZ - MINZ), flagstone), (MINX + MAXX) / 2, 0.02, (MINZ + MAXZ) / 2)
    .rotation.x = -Math.PI / 2;
  function wall(w, x, z, ry) { const m = M(new THREE.BoxGeometry(w, H, 0.6), brickMat); m.rotation.y = ry; add(m, x, H / 2, z); m.castShadow = m.receiveShadow = true; }
  wall(MAXZ - MINZ, MAXX, (MINZ + MAXZ) / 2, Math.PI / 2);   // east
  wall(MAXX - MINX, (MINX + MAXX) / 2, MINZ, 0);             // north
  wall(MAXX - MINX, (MINX + MAXX) / 2, MAXZ, 0);             // south

  // a tall window on the east wall (single-window chiaroscuro) + light shaft
  const win = M(new THREE.PlaneGeometry(2.0, 3.2), new THREE.MeshBasicMaterial({ color: 0xf2ead2 }));
  win.rotation.y = -Math.PI / 2; add(win, MAXX - 0.32, 4.2, -7);
  const winLight = new THREE.PointLight(0xfff3d8, 3.2, 22, 1.6); add(winLight, MAXX - 3, 4.6, -7);

  // roof beams (open between them — keeps the room lit but reads as interior)
  for (let bz = MINZ + 2; bz < MAXZ; bz += 2.6) {
    const beam = M(new THREE.BoxGeometry(MAXX - MINX, 0.35, 0.35), woodMat);
    add(beam, (MINX + MAXX) / 2, H - 0.4, bz);
  }

  // =========================================================================
  // ATHANOR — self-feeding tower furnace, with the philosophical egg in its
  // sand-bath side-port (the digestion subject).
  // =========================================================================
  const athanor = new THREE.Group(); group.add(athanor);
  add(M(new THREE.BoxGeometry(2.6, 2.0, 2.6), brickMat), 14, 1.0, -13.6, athanor).castShadow = true;
  add(M(new THREE.BoxGeometry(2.0, 1.6, 2.0), brickMat), 14, 2.8, -13.6, athanor);
  add(M(new THREE.CylinderGeometry(0.75, 0.8, 2.0, 16), brickMat), 14, 4.6, -13.6, athanor);
  add(M(new THREE.CylinderGeometry(0.45, 0.85, 1.0, 16), brickMat), 14, 5.9, -13.6, athanor); // hopper
  // stoking mouth (front, +z)
  add(M(new THREE.BoxGeometry(1.0, 0.9, 0.3), new THREE.MeshBasicMaterial({ color: 0x140d06 })), 14, 0.8, -12.32, athanor);
  flame(14, 0.9, -12.25, 1.1); flame(14, 1.15, -12.2, 0.8, 0xffd27a);
  const athanorLight = emberLight(14, 1.0, -12.0, 0xff7a1a, 4, 12);
  // side-port niche + sand bath holding the egg
  add(M(new THREE.BoxGeometry(1.3, 1.3, 0.35), new THREE.MeshBasicMaterial({ color: 0x1c150d })), 14, 2.0, -12.32, athanor);
  add(M(new THREE.CylinderGeometry(0.6, 0.62, 0.22, 16), toon({ color: 0xb9a47a })), 14, 1.6, -12.05, athanor); // sand bath
  vapor(14, 6.4, -13.6);

  // the philosophical egg (its own material so we can recolour it per stage)
  const eggMat = toon({ color: STAGES[0].color, emissive: STAGES[0].glow, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 });
  const labEgg = M(new THREE.SphereGeometry(0.42, 36, 36), eggMat);
  labEgg.scale.set(1, 1.32, 1); add(labEgg, 14, 2.05, -12.0, athanor);
  // fused neck (Seal of Hermes)
  add(M(new THREE.CylinderGeometry(0.05, 0.09, 0.3, 12), eggMat), 14, 2.62, -12.0, athanor);
  const eggGlow = new THREE.PointLight(STAGES[0].glow, 0.8, 5, 2); add(eggGlow, 14, 2.1, -11.7, athanor);

  // =========================================================================
  // REVERBERATORY FURNACE — domed chamber, separate firebox, tall chimney
  // =========================================================================
  const reverb = new THREE.Group(); group.add(reverb);
  add(M(new THREE.BoxGeometry(2.4, 2.0, 3.2), brickMat), 24.6, 1.0, -11, reverb);
  const dome = M(new THREE.CylinderGeometry(1.2, 1.2, 3.2, 16, 1, false, 0, Math.PI), brickMat);
  dome.rotation.z = Math.PI / 2; dome.rotation.y = Math.PI / 2; add(dome, 24.6, 2.0, -11, reverb);
  add(M(new THREE.BoxGeometry(0.8, 4.0, 0.8), brickMat), 24.8, 4.0, -12.6, reverb); // chimney
  add(M(new THREE.BoxGeometry(0.7, 0.7, 0.3), new THREE.MeshBasicMaterial({ color: 0x140d06 })), 23.3, 0.8, -10, reverb);
  flame(23.25, 0.85, -9.9, 0.8); emberLight(23.4, 1.0, -9.6, 0xff6a14, 2.6, 8);
  vapor(24.8, 6.0, -12.6);

  // =========================================================================
  // DISTILLATION still — small furnace + cucurbit + alembic + receiver
  // =========================================================================
  const still = new THREE.Group(); group.add(still);
  add(M(new THREE.BoxGeometry(1.5, 1.3, 1.5), brickMat), 24.4, 0.65, -2, still);
  add(M(new THREE.BoxGeometry(0.6, 0.5, 0.25), new THREE.MeshBasicMaterial({ color: 0x140d06 })), 23.6, 0.5, -2, still);
  flame(23.55, 0.55, -1.9, 0.6); emberLight(23.7, 0.7, -1.6, 0xff7a1a, 2, 7);
  const cucurbit = M(new THREE.SphereGeometry(0.55, 24, 20), glass); cucurbit.scale.set(1, 0.9, 1); add(cucurbit, 24.4, 1.7, -2, still);
  const alembic = M(new THREE.ConeGeometry(0.6, 0.8, 20), glass); add(alembic, 24.4, 2.45, -2, still);
  const beak = M(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), glass); beak.rotation.z = Math.PI / 2.6; add(beak, 24.0, 2.2, -2, still);
  add(M(new THREE.SphereGeometry(0.32, 18, 16), glass), 23.3, 1.0, -2, still); // receiver
  vapor(24.4, 3.1, -2);

  // =========================================================================
  // BALNEUM MARIAE — copper cauldron of water on a small furnace, flask within
  // =========================================================================
  const balneum = new THREE.Group(); group.add(balneum);
  add(M(new THREE.BoxGeometry(1.4, 1.2, 1.4), brickMat), 14, 0.6, 2.2, balneum);
  add(M(new THREE.CylinderGeometry(0.62, 0.55, 0.5, 18), copper), 14, 1.4, 2.2, balneum);
  add(M(new THREE.CylinderGeometry(0.6, 0.53, 0.08, 18), new THREE.MeshBasicMaterial({ color: 0x6f97a8, transparent: true, opacity: 0.7 })), 14, 1.62, 2.2, balneum); // water
  add(M(new THREE.SphereGeometry(0.3, 18, 16), glass), 14, 1.75, 2.2, balneum); // flask
  emberLight(14, 0.8, 3.0, 0xff7a1a, 1.6, 6); flame(14, 0.6, 3.05, 0.5);
  vapor(14, 2.3, 2.2);

  // =========================================================================
  // WORK TABLE — crucible (regulus op), mortar & pestle, retort, notebook
  // =========================================================================
  const table = new THREE.Group(); group.add(table);
  const TY = 1.0;
  add(M(new THREE.BoxGeometry(3.8, 0.22, 1.7), woodMat), 19, TY, 0.5, table).castShadow = true;
  for (const lx of [-1.7, 1.7]) for (const lz of [-0.6, 0.6])
    add(M(new THREE.BoxGeometry(0.2, TY, 0.2), woodMat), 19 + lx, TY / 2, 0.5 + lz, table);

  // brazier + Hessian crucible (triangular, 3 spouts) — the fusion op
  add(M(new THREE.CylinderGeometry(0.42, 0.36, 0.3, 16), iron), 18.2, TY + 0.27, 0.4, table); // brazier bowl
  const crucible = M(new THREE.ConeGeometry(0.26, 0.42, 3), ceramic); // triangular
  crucible.rotation.y = Math.PI / 6; add(crucible, 18.2, TY + 0.55, 0.4, table);
  const crucibleGlow = new THREE.PointLight(0xff5a1a, 0.0, 4, 2); add(crucibleGlow, 18.2, TY + 0.6, 0.4, table);
  flame(18.2, TY + 0.45, 0.4, 0.45);

  // bronze mortar & pestle
  add(M(new THREE.CylinderGeometry(0.22, 0.16, 0.28, 16), bronze), 19.9, TY + 0.25, 0.7, table);
  const pestle = M(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 10), bronze); pestle.rotation.z = 0.5; add(pestle, 20.0, TY + 0.4, 0.7, table);

  // small retort on a stand
  add(M(new THREE.SphereGeometry(0.28, 18, 16), glass), 20.6, TY + 0.3, -0.1, table);
  const rneck = M(new THREE.TorusGeometry(0.32, 0.045, 8, 14, Math.PI / 1.5), glass);
  rneck.rotation.z = -0.6; add(rneck, 20.95, TY + 0.25, -0.1, table);

  // the laboratory notebook
  add(M(new THREE.BoxGeometry(0.5, 0.06, 0.36), toon({ color: 0x8a6a44 })), 17.4, TY + 0.14, 0.7, table);

  // =========================================================================
  // SHELVES of labelled glassware along the south wall, incl. pelican & aludel
  // =========================================================================
  function shelfRow(y) {
    add(M(new THREE.BoxGeometry(11, 0.14, 0.5), woodMat), 19, y, MAXZ - 0.45);
    for (let i = 0; i < 9; i++) {
      const x = 14 + i * 1.25;
      const kind = i % 3;
      let v;
      if (kind === 0) { v = M(new THREE.SphereGeometry(0.18, 14, 12), glass); v.scale.set(1, 1.3, 1); }
      else if (kind === 1) { v = M(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 12), glass); }
      else { v = M(new THREE.ConeGeometry(0.17, 0.4, 12), ceramic); }
      add(v, x, y + 0.28, MAXZ - 0.45);
    }
  }
  shelfRow(2.2); shelfRow(3.5);

  // pelican (circulatory vessel) — body + two looping arms
  const pelican = new THREE.Group(); add(new THREE.Object3D(), 0, 0, 0, pelican);
  const pbody = M(new THREE.SphereGeometry(0.26, 18, 16), glass); pelican.add(pbody);
  for (const s of [1, -1]) {
    const arm = M(new THREE.TorusGeometry(0.22, 0.04, 8, 16, Math.PI), glass);
    arm.rotation.z = Math.PI / 2; arm.position.x = s * 0.18; arm.rotation.y = s > 0 ? 0 : Math.PI;
    pelican.add(arm);
  }
  pelican.position.set(16, 3.5 + 0.3, MAXZ - 0.45); group.add(pelican);

  // aludel (stacked sublimation pots) on the lower shelf
  const aludel = new THREE.Group();
  for (let i = 0; i < 3; i++) add(M(new THREE.CylinderGeometry(0.14 - i * 0.02, 0.18 - i * 0.02, 0.3, 12), ceramic), 0, i * 0.28, 0, aludel);
  aludel.position.set(22.5, 2.34, MAXZ - 0.45); group.add(aludel);

  // =========================================================================
  // OPERATIONS
  // =========================================================================
  const state = { stage: 0, fusing: false, fuseT: 0, regulus: null };

  function applyStage() {
    const s = STAGES[state.stage];
    eggMat.color.setHex(s.color);
    eggMat.emissive.setHex(s.glow);
    eggGlow.color.setHex(s.glow);
    eggGlow.intensity = state.stage === 0 ? 0.6 : 1.2;
    onStage && onStage(s, state.stage, STAGES.length);
  }

  function digestStep() {
    state.stage = (state.stage + 1) % STAGES.length;
    applyStage();
    return STAGES[state.stage];
  }

  let starTex = null;
  function makeStarTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#c9ccd2"; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "rgba(120,128,140,0.9)"; x.lineWidth = 2;
    for (let a = 0; a < 12; a++) { x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + 64 * Math.cos(a * Math.PI / 6), 64 + 64 * Math.sin(a * Math.PI / 6)); x.stroke(); }
    return new THREE.CanvasTexture(c);
  }

  function fuseRegulus() {
    if (state.fusing || state.regulus) return false;
    state.fusing = true; state.fuseT = 0;
    return true;
  }

  function animate(t, dt) {
    flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(t * (9 + i) + i) * 0.3;
      f.material.opacity = 0.7 + Math.sin(t * 8 + i) * 0.2;
    });
    lights.forEach((l, i) => l.intensity = l.userData.base * (0.85 + Math.sin(t * (10 + i)) * 0.18));
    vapors.forEach((s) => {
      s.position.y += s.userData.speed * dt;
      s.material.opacity *= 0.992;
      if (s.position.y > s.userData.y0 + 2.4 || s.material.opacity < 0.02) {
        s.position.set(s.userData.x0, s.userData.y0, s.userData.z0); s.material.opacity = 0.14;
      }
    });
    // egg shimmer
    const b = Math.sin(t * 1.4);
    labEgg.scale.set(1 + b * 0.012, 1.32 + b * 0.014, 1 + b * 0.012);

    // fusion -> star regulus
    if (state.fusing) {
      state.fuseT += dt;
      crucibleGlow.intensity = Math.min(6, state.fuseT * 3) * (0.8 + Math.sin(t * 20) * 0.2);
      if (state.fuseT > 3 && !state.regulus) {
        if (!starTex) starTex = makeStarTexture();
        const reg = M(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 24),
          new THREE.MeshStandardMaterial({ map: starTex, metalness: 0.8, roughness: 0.35 }));
        add(reg, 18.2, TY + 0.62, 0.4, table);
        state.regulus = reg;
      }
      if (state.fuseT > 4.5) { state.fusing = false; crucibleGlow.intensity = 0.4; }
    }
  }

  applyStage();

  // interactives the player can use (raycast targets) — context-sensitive E
  labEgg.userData = {
    name: "digest",
    prompt: () => `Press <b>E</b> — stoke the athanor (advance to ${STAGES[(state.stage + 1) % STAGES.length].label})`,
    action: digestStep,
  };
  crucible.userData = {
    name: "regulus",
    prompt: () => state.regulus
      ? "The star regulus of antimony is cast."
      : (state.fusing ? "The crucible glows — the regulus is forming…" : "Press <b>E</b> — fuse stibnite + iron (Mars assists Vulcan)"),
    action: fuseRegulus,
  };

  return {
    group,
    bounds: { MINX, MAXX, MINZ, MAXZ },
    door: { z0: -5.4, z1: -2.6 },
    interactives: [labEgg, crucible],
    focus: {
      athanor: { pos: new THREE.Vector3(17.5, 2.4, -10), look: new THREE.Vector3(14, 2.0, -12.5) },
      crucible: { pos: new THREE.Vector3(20.5, 1.9, 2.0), look: new THREE.Vector3(18.2, 1.4, 0.4) },
    },
    animate, digestStep, fuseRegulus, state,
  };
}

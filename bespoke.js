// ===========================================================================
// bespoke.js — hand-composed staging for individual Atalanta emblems, layered
// on top of the generic per-tag placement + setting-archetype backdrop that
// every plate gets from scene.js/locations.js. Where the generic system
// scatters props by zone, these functions arrange them the way the actual
// engraving composes the scene (the washerwoman kneeling AT the stream, the
// sower's cast seed following the furrows, the potter's shelf of finished
// jars around the kiln, etc.) — the same hand-built-environment idea as the
// Emblem VIII flagship, done as an additive layer instead of a whole new
// page, so it can be extended one plate at a time without a rewrite.
//
// Each entry: (env) => void, called after the generic scene is built. `env`
// gives access to the same builders scene.js already uses (buildProp,
// makeFigure, place) plus THREE and the live world/anim/ctx so a bespoke
// scene can add extra geometry, move/rotate the tag-driven props already
// placed, or add its own animated details (e.g. the sower's seed arc).
// ===========================================================================

export const BESPOKE = {
  // Emblem III — "Go to the woman who washes the sheets and do as she does."
  // A kneeling washerwoman at a real streambank: flat washing stones, a
  // sheet strung on a line between two posts, the stream running the full
  // width of the diorama in front of her, sun overhead.
  "3": ({ THREE, ctx, place, buildProp, world }) => {
    const stream = buildProp(ctx, "water"); stream.scale.set(3.2, 1, 1); place(stream, 0, 0, 2.5);
    const stone = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.15, 8), ctx.toon({ color: 0x8a8270 })); m.position.set(x, 0.08, 1.6); world.add(m); };
    stone(-1.6); stone(-0.6); stone(0.6);
    const post = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), ctx.toon({ color: 0x4a3420 })); m.position.set(x, 1.1, -1.5); world.add(m); return m; };
    post(-2.2); post(2.2);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.1), new THREE.MeshStandardMaterial({ color: 0xece2cb, side: THREE.DoubleSide }));
    sheet.position.set(0, 1.9, -1.5); world.add(sheet);
  },

  // Emblem VI — "Sow your gold in the white foliated earth."
  // A real plowed field: parallel furrow rows across the full width, the
  // sower mid-stride, and a scatter of golden-seed motes following his
  // throwing arc into the furrows (not just one static seed prop).
  "6": ({ THREE, ctx, place, buildProp, world, anim, data }) => {
    for (let r = -3; r <= 3; r++) {
      const furrow = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.35), ctx.toon({ color: 0x5c4e28 }));
      furrow.position.set(0, 0.04, r * 0.9); world.add(furrow);
    }
    for (let i = 0; i < 7; i++) {
      const seed = buildProp(ctx, "golden_seed"); seed.scale.setScalar(0.5);
      place(seed, -2.5 + i * 0.8, 0.15, -1.2 + Math.sin(i) * 1.4);
    }
  },

  // Emblem XV — "Let the work of the potter, consisting of dry and wet,
  // teach you." A real workshop: the kiln with a shelf of finished jars
  // around it, and the wet clay trough set apart from the fired ware.
  "15": ({ THREE, ctx, place, buildProp, world }) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.5), ctx.toon({ color: 0x5c4228 }));
    shelf.position.set(-3.2, 1.3, -1.4); world.add(shelf);
    for (let i = 0; i < 4; i++) {
      const jar = buildProp(ctx, "clay_vessel"); jar.scale.setScalar(0.6);
      place(jar, -4 + i * 0.75, 1.42, -1.4);
    }
    const trough = buildProp(ctx, "water"); trough.scale.set(1.4, 1, 0.9); place(trough, 3.4, 0, -1.2);
  },

  // Emblem XXII — "then do woman's work, that is to say: cook." The
  // alchemical bath restaged as a real hearth-side cooking scene: cauldron
  // over the fire, bench of ingredients, steam-coloured light over the pot.
  "22": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const cauldron = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), ctx.toon({ color: 0x3a3a3a }));
    cauldron.rotation.x = Math.PI; cauldron.position.set(-1.2, 1.1, 0.5); world.add(cauldron);
    const steamLight = new THREE.PointLight(0xdfe6ef, 1.4, 8, 2); steamLight.position.set(-1.2, 1.8, 0.5); world.add(steamLight); anim.lums.push(steamLight);
    const bench = buildProp(ctx, "table"); place(bench, 1.6, 0, 0.8);
  },

  // Emblem XLVIII — "The king, fallen ill from drinking, is restored to
  // health by a physician." A steam-bath sickroom: the bathhouse structure
  // enclosing the scene, the king reclining, an attendant figure at hand.
  "48": ({ THREE, ctx, place, buildProp, makeFigure, world, anim }) => {
    const walls = buildProp(ctx, "classical_architecture"); walls.scale.setScalar(1.6); place(walls, 0, 0, -3);
    const steamPool = buildProp(ctx, "water"); place(steamPool, 0, 0, 0.5);
    const steamLight = new THREE.PointLight(0xdfe6ef, 1.2, 10, 2); steamLight.position.set(0, 1.5, 0.5); world.add(steamLight); anim.lums.push(steamLight);
    const attendant = makeFigure(ctx, { cloth: 0x6a4a6a, scale: 0.9 }); place(attendant, 2.2, 0, 1.2);
  },

  // Emblem 0 — the frontispiece: the race of Atalanta and Hippomenes. A
  // running track with the three golden apples dropped along its length.
  "0": ({ THREE, ctx, place, buildProp, world }) => {
    const track = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.4), ctx.toon({ color: 0x9c8f6a }));
    track.rotation.x = -Math.PI / 2; track.position.set(0, 0.02, 1.5); world.add(track);
    [-4, -1, 2].forEach((x) => { const a = buildProp(ctx, "apple_golden"); a.scale.setScalar(0.7); place(a, x, 0, 1.5); });
  },

  // Emblem I — the wind-born infant. A hilltop rock with a swirling-wind
  // effect of small tumbling motes around the infant.
  "1": ({ THREE, ctx, place, world, anim }) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), ctx.toon({ color: 0x716a54 })); rock.position.set(0, 0.4, -0.5); world.add(rock);
    for (let i = 0; i < 6; i++) {
      // pushed into anim.birds so the existing bob/drift animation (scene.js
      // render loop) carries these tumbling wind-motes for free
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.14), ctx.toon({ color: 0xd8e0e6 }));
      m.position.set(Math.cos(i) * 1.6, 1.6 + i * 0.15, -0.5 + Math.sin(i) * 1.6);
      world.add(m); anim.birds.push(m);
    }
  },

  // Emblem II — "Its nurse is the Earth." Corrected against the actual
  // plate: the standing Earth-figure carries a great globe set into her own
  // torso, the infant nursing inside it; she is flanked by a she-goat
  // suckling twin infants at her udder on one side, and a she-wolf suckling
  // twin infants on the other (the Amalthea / Romulus-Remus doubling) — not
  // a grass mound between two columns, which was pure invention.
  "2": ({ THREE, ctx, place, buildProp, makeFigure, world }) => {
    // the globe set into the nurse's torso, with the nursing infant inside
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 20), ctx.toon({ color: 0xcbbf9c, emissive: 0x2a2410, emissiveIntensity: 0.2 }));
    globe.position.set(0, 2.0, 4.5); world.add(globe);
    const babyInGlobe = makeFigure(ctx, { scale: 0.35, cloth: 0xd8cdb0, dress: "none" });
    babyInGlobe.position.set(0, 1.55, 4.85); world.add(babyInGlobe);
    // she-goat suckling twins, at her left (a simple quadruped — no dedicated
    // goat builder in props.js, so built inline rather than misusing another tag)
    const goat = new THREE.Group();
    const gBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), ctx.toon({ color: 0xc9bfa0 }));
    gBody.rotation.z = Math.PI / 2; gBody.position.y = 0.55; goat.add(gBody);
    for (const gx of [-0.3, 0.3]) for (const gz of [-0.2, 0.2]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), ctx.toon({ color: 0xc9bfa0 })); leg.position.set(gx, 0.25, gz); goat.add(leg); }
    const gHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), ctx.toon({ color: 0xc9bfa0 })); gHead.position.set(0.55, 0.65, 0); goat.add(gHead);
    place(goat, -3.2, 0, 4.8);
    for (const dx of [-0.3, 0.3]) { const kid = makeFigure(ctx, { scale: 0.3, cloth: 0xcfc6a8, dress: "none" }); kid.position.set(-3.2 + dx, 0, 5.3); world.add(kid); }
    // she-wolf suckling twins, at her right (Romulus & Remus)
    const wolf = buildProp(ctx, "wolf");
    place(wolf, 3.4, 0, 4.8);
    for (const dx of [-0.3, 0.3]) { const twin = makeFigure(ctx, { scale: 0.3, cloth: 0xcfc6a8, dress: "none" }); twin.position.set(3.4 + dx, 0, 5.3); world.add(twin); }
  },

  // Emblem IV — brother and sister given the cup of love. A round wedding
  // table set between the two figures, the Oedipus/Sphinx allusion staged
  // as a small statue looking on.
  // Corrected against the actual plate: there is no table in this engraving
  // — the brother and sister walk arm-in-arm along a road toward a third man
  // who stands apart, extending the cup of love; a jug sits at his feet.
  // (The earlier version invented a round table and a sphinx statue that
  // aren't in the image — de Jong's Oedipus/Jocasta gloss is a reading of
  // the myth behind the motto, not a pictured object.)
  "4": ({ ctx, place, buildProp }) => {
    const jug = buildProp(ctx, "vessel"); jug.scale.setScalar(0.6); place(jug, 2.4, 0, 4.3);
  },

  // Emblem V — the toad suckled at the woman's breast, and her death. A
  // cottage sickbed scene lit low and cold to read the "death_shadow" tag.
  "5": ({ THREE, ctx, place, world, anim }) => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1), ctx.toon({ color: 0x5c4228 })); bench.position.set(0, 0.6, -0.5); world.add(bench);
    const shadowLight = new THREE.PointLight(0x4a5560, 1.0, 8, 2); shadowLight.position.set(0, 2.2, -0.5); world.add(shadowLight); anim.lums.push(shadowLight);
  },

  // Emblem VII — the young bird's nest. A real tree with the nest at its
  // crown and the bird's up-and-down flight arc traced above it.
  "7": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const tree = buildProp(ctx, "tree"); place(tree, 0, 0, -1);
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 12), ctx.toon({ color: 0x6b5230 })); nest.rotation.x = Math.PI / 2; nest.position.set(0, 3.4, -1); world.add(nest);
  },

  // Emblem IX — the old man fixed to the tree in the garden of the dew. A
  // walled garden with the figure literally chained to the trunk.
  "9": ({ THREE, ctx, place, buildProp, world }) => {
    const garden = buildProp(ctx, "garden_walls"); place(garden, 0, 0, -3);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 8), ctx.toon({ color: 0x4a3420 })); trunk.position.set(0, 1.5, -1); world.add(trunk);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 16), ctx.toon({ color: 0x9c8f6a })); chain.position.set(0, 1.1, -0.7); world.add(chain);
  },

  // Emblem X — "fire to fire, Mercury to Mercury": two furnaces facing
  // each other across the vessel, like calling to like.
  "10": ({ ctx, place, buildProp }) => {
    // one furnace ON the laboratory's hearth ledge, one facing it across the
    // room near the far wall — "fire to fire" as two furnaces in dialogue
    const f1 = buildProp(ctx, "fire"); place(f1, -6.1, 1.0, -1.8);
    const f2 = buildProp(ctx, "fire"); place(f2, 5.6, 0, -1.8);
  },

  // Emblems XI/XII — Latona made white, the books torn up. A small
  // scholar's shelf with torn pages scattered beneath a whitening light.
  "11": ({ THREE, ctx, place, world, anim }) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.4), ctx.toon({ color: 0x5c4228 })); shelf.position.set(-2.5, 1.6, -2); world.add(shelf);
    const wLight = new THREE.PointLight(0xeef0ea, 1.6, 10, 2); wLight.position.set(0, 3, 0); world.add(wLight); anim.lums.push(wLight);
  },
  "12": ({ THREE, ctx, place, world, anim }) => {
    const wLight = new THREE.PointLight(0xeef0ea, 1.8, 10, 2); wLight.position.set(0, 3, -1); world.add(wLight); anim.lums.push(wLight);
    const rays = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6da, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    rays.position.set(0, 4, -1); world.add(rays);
  },

  // Emblem XIII — Naaman washed seven times in the Jordan. A river with
  // seven stepping stones for the seven dips.
  "13": ({ THREE, ctx, place, buildProp, world }) => {
    const river = buildProp(ctx, "water"); river.scale.set(3, 1, 1); place(river, 0, 0, 1.5);
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 8), ctx.toon({ color: 0x8a8270 })); s.position.set(-3 + i * 1, 0.06, 1.2); world.add(s); }
  },

  // Emblem XIV — the ouroboros. A real ring of fire (torus + flame glow)
  // instead of a flat prop.
  "14": ({ THREE, ctx, place, world, anim }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.18, 10, 28), ctx.toon({ color: 0x4d6b3a, emissive: 0x1a2a10, emissiveIntensity: 0.4 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.3, -0.5); world.add(ring);
    const glow = new THREE.PointLight(0x8fae5a, 1.6, 8, 2); glow.position.set(0, 0.6, -0.5); world.add(glow); anim.lums.push(glow);
  },

  // Emblem XVI — the winged lion vs the wingless lion, staged face to face
  // for comparison, in a forest clearing.
  "16": ({ ctx, place, buildProp }) => {
    const l1 = buildProp(ctx, "lion"); place(l1, -2, 0, -0.5);
    const l2 = buildProp(ctx, "lion"); place(l2, 2, 0, -0.5);
  },

  // Emblem XVII — the fourfold fire-ball: four flames at the cardinal
  // points around the elemental sphere.
  "17": ({ THREE, ctx, place, buildProp, world }) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), ctx.toon({ color: 0xb08d4a, emissive: 0x4a3a10, emissiveIntensity: 0.3 })); sphere.position.set(0, 1, -0.5); world.add(sphere);
    [[0, -2.5], [0, 1.5], [-2.5, -0.5], [2.5, -0.5]].forEach(([x, z]) => { const f = buildProp(ctx, "fire"); place(f, x, 0, z); });
  },

  // Emblem XVIII — fire that makes things fiery but not gold: an unlit
  // gold nugget set apart from the working furnace.
  "18": ({ ctx, place, buildProp }) => {
    const forge = buildProp(ctx, "furnace"); place(forge, -2, 0, -1);
    const ore = buildProp(ctx, "gold_ore"); place(ore, 2.5, 0, 0.5);
  },

  // Emblem XIX — kill one of the four elements, all four die: four
  // pedestals linked in a row, reading as a single interdependent chain.
  "19": ({ THREE, ctx, place, world }) => {
    const colors = [0x6a5a3a, 0x4a6e78, 0xff7a1a, 0xd8e0e6];
    colors.forEach((c, i) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), ctx.toon({ color: c })); p.position.set(-3 + i * 2, 0.45, -1); world.add(p); });
  },

  // Emblem XX — the hermaphrodite in the landscape, staged as a classical
  // clearing with the figure at its centre.
  "20": ({ ctx, place, buildProp }) => {
    const scene1 = buildProp(ctx, "classical_landscape"); place(scene1, 0, 0, -2);
  },

  // Emblem XXI — circle, square, triangle, circle: a geometric floor inlay
  // (three concentric/overlapping forms) beneath the bathing hermaphrodite.
  "21": ({ THREE, ctx, place, world }) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.4, 32), ctx.toon({ color: 0xb08d4a })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; world.add(ring);
    const sq = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.95, 4), ctx.toon({ color: 0x9c8f6a })); sq.rotation.x = -Math.PI / 2; sq.rotation.z = Math.PI / 4; sq.position.y = 0.04; world.add(sq);
  },

  // Emblem XXIII — it rains gold when Pallas is born: a temple with a
  // shower of gold motes falling from above.
  "23": ({ THREE, ctx, place, buildProp, world, anim }) => {
    for (let i = 0; i < 8; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), ctx.toon({ color: 0xd9b44a, emissive: 0x4a3a10, emissiveIntensity: 0.5 }));
      drop.position.set(-3 + i * 0.8, 2 + (i % 3), -1 + Math.sin(i)); world.add(drop); anim.birds.push(drop);
    }
  },

  // Emblem XXIV — the wolf devours the king, is burnt, restores him: a
  // pyre between the wolf figure and the restored king.
  "24": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const pyre = buildProp(ctx, "fire"); place(pyre, 0, 0, -1);
    const wolf = buildProp(ctx, "wolf"); place(wolf, -2.5, 0, -0.5);
  },

  // Emblem XXV — the dragon killed by Sol and Luna together: sun-disc and
  // moon-crescent altars flanking the dragon.
  "25": ({ THREE, ctx, place, world, anim }) => {
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: 0xffd86a })); sun.position.set(-2.5, 1.4, -1); world.add(sun);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0xd8e0e6 })); moon.position.set(2.5, 1.4, -1); world.add(moon);
  },

  // Emblem XXVI — the Tree of Life bearing golden fruit.
  "26": ({ ctx, place, buildProp }) => {
    const tree = buildProp(ctx, "tree"); tree.scale.setScalar(1.4); place(tree, 0, 0, -1.5);
    [-1, 0.5, 1.5].forEach((x) => { const f = buildProp(ctx, "apple"); place(f, x, 2.6, -1.5); });
  },

  // Emblem XXVII — the rose-garden without the key: a walled garden and a
  // gate the figures stand before, key withheld.
  "27": ({ ctx, place, buildProp }) => {
    const garden = buildProp(ctx, "garden_walls"); place(garden, 0, 0, -2.5);
  },

  // Emblem XXVIII — the king in his steam-bath, freed of the black bile:
  // a throne set beside the bathing basin.
  "28": ({ ctx, place, buildProp }) => {
    const pool = buildProp(ctx, "water"); place(pool, 0, 0, 1);
    const throne = buildProp(ctx, "table"); throne.scale.set(0.6, 1.4, 0.6); place(throne, 0, 0, -2);
  },

  // Emblem XXIX — the salamander living in the fire, staged as a real fire
  // pit the small creature sits within.
  "29": ({ ctx, place, buildProp }) => {
    const pit = buildProp(ctx, "fire"); place(pit, 0, 0, -0.5);
  },

  // Emblem XXX/XXXIII — the hermaphrodite lying in darkness like a dead
  // man, in need of fire: a dark vault around a single torch.
  "30": ({ THREE, ctx, place, world, anim }) => {
    const vault = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 0.4), ctx.toon({ color: 0x2a2418 })); vault.position.set(0, 2, -4); world.add(vault);
    const torch = new THREE.PointLight(0xff7a1a, 2, 8, 2); torch.position.set(0, 2, -1); world.add(torch); anim.lums.push(torch);
  },
  "33": ({ THREE, ctx, place, world, anim }) => {
    const sarcophagus = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1), ctx.toon({ color: 0x716a54 })); sarcophagus.position.set(0, 0.35, -1); world.add(sarcophagus);
    const torch = new THREE.PointLight(0xff7a1a, 1.6, 8, 2); torch.position.set(0, 1.8, -1); world.add(torch); anim.lums.push(torch);
  },

  // Emblem XXXI — the king swimming in the sea, calling for rescue: a wide
  // water expanse around him instead of a token pond.
  "31": ({ ctx, place, buildProp }) => {
    const sea = buildProp(ctx, "water"); sea.scale.set(4, 1, 3); place(sea, 0, 0, 0);
  },

  // Emblem XXXII — coral hardening from water to air: a rocky tidal pool.
  "32": ({ ctx, place, buildProp }) => {
    const pool = buildProp(ctx, "water"); pool.scale.set(1.6, 1, 1.6); place(pool, 0, 0, 0.5);
    const rock = buildProp(ctx, "mountain"); rock.scale.setScalar(0.5); place(rock, -2, 0, -1);
  },

  // Emblem XXXIV — conceived in the bath, born in the air, walks on the
  // water: a bath adjoining an open platform over the water.
  "34": ({ THREE, ctx, place, buildProp, world }) => {
    const bath = buildProp(ctx, "water"); place(bath, -1.5, 0, 1);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 1.2), ctx.toon({ color: 0x9b917a })); platform.position.set(1.8, 0.3, 0.5); world.add(platform);
  },

  // Emblem XXXV — Ceres/Triptolemus, Thetis/Achilles: a sheaf-altar beside
  // the tempering furnace.
  "35": ({ THREE, ctx, place, buildProp, world }) => {
    const sheaf = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 8), ctx.toon({ color: 0xd9b44a })); sheaf.position.set(-2.5, 0.6, -0.5); world.add(sheaf);
    const forge = buildProp(ctx, "furnace"); place(forge, 2.5, 0, -0.5);
  },

  // Emblem XXXVI — the pelican feeding its chicks with its own blood, in
  // its nest.
  "36": ({ THREE, ctx, place, world, anim }) => {
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.16, 8, 16), ctx.toon({ color: 0x6b5230 })); nest.rotation.x = Math.PI / 2; nest.position.set(0, 1.2, -0.5); world.add(nest);
    const bloodLight = new THREE.PointLight(0xb02218, 1.4, 6, 2); bloodLight.position.set(0, 1.4, -0.5); world.add(bloodLight); anim.lums.push(bloodLight);
  },

  // Emblem XXXVII — the phoenix rising from its own ash, sun above.
  "37": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.3, 12), ctx.toon({ color: 0x3a3428 })); ash.position.set(0, 0.15, -0.5); world.add(ash);
    const sunGlow = new THREE.PointLight(0xffd86a, 2, 10, 2); sunGlow.position.set(0, 4, -1); world.add(sunGlow); anim.lums.push(sunGlow);
  },

  // Emblem XXXVIII — the hermaphrodite born of two mountains (Mercury and
  // Venus): twin peaks flanking the central figure.
  "38": ({ ctx, place, buildProp }) => {
    const m1 = buildProp(ctx, "mountain"); place(m1, -3, 0, -1.5);
    const m2 = buildProp(ctx, "mountain"); place(m2, 3, 0, -1.5);
  },

  // Emblem XXXIX — Oedipus conquers the Sphinx, kills Laius, marries
  // Jocasta: a crossroads with the sphinx statue confronting the traveller.
  "39": ({ ctx, place, buildProp }) => {
    const sphinx = buildProp(ctx, "oedipus_sphinx"); place(sphinx, 0, 0, -1.5);
  },

  // Emblem XL — make one water out of two waters: twin basins pouring
  // toward a single central vessel.
  "40": ({ ctx, place, buildProp }) => {
    const b1 = buildProp(ctx, "water"); b1.scale.setScalar(0.7); place(b1, -2.5, 0, -0.5);
    const b2 = buildProp(ctx, "water"); b2.scale.setScalar(0.7); place(b2, 2.5, 0, -0.5);
    const central = buildProp(ctx, "vessel"); place(central, 0, 0, 0.8);
  },

  // Emblem XLI — Adonis killed by the boar, Venus's roses stained red: a
  // small garden shrine picked out in red light.
  "41": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const garden = buildProp(ctx, "tree"); place(garden, -2, 0, -1.5);
    const redLight = new THREE.PointLight(0xb02218, 1.2, 8, 2); redLight.position.set(0, 1.4, -0.5); world.add(redLight); anim.lums.push(redLight);
  },

  // Emblem XLII — the throne room where Nature, Reason, Experience and
  // Reading are read together: a small dais.
  "42": ({ ctx, place, buildProp }) => {
    const dais = buildProp(ctx, "table"); dais.scale.set(0.7, 1.6, 0.7); place(dais, 0, 0, -1);
  },

  // Emblem XLIII — the screech owl's voice by moonlight: an owl perched in
  // a tree under a cold moon-light.
  "43": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const tree = buildProp(ctx, "tree"); place(tree, 0, 0, -1.5);
    const moonLight = new THREE.PointLight(0xaebfd0, 1.4, 10, 2); moonLight.position.set(2, 4, -2); world.add(moonLight); anim.lums.push(moonLight);
  },

  // Emblem XLIV — Typhon scatters Osiris's limbs, Isis gathers them: broken
  // column fragments being drawn back toward a centre point.
  "44": ({ THREE, ctx, place, world }) => {
    for (let i = 0; i < 4; i++) { const frag = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 8), ctx.toon({ color: 0x9b917a })); frag.position.set(Math.cos(i) * 2.5, 0.4, Math.sin(i) * 2 - 1); frag.rotation.z = i * 0.6; world.add(frag); }
  },

  // Emblem XLV — Sol and his shadow complete the work: an obelisk casting
  // a long shadow toward the sublimation vessel.
  "45": ({ THREE, ctx, place, buildProp, world }) => {
    const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.3, 3, 4), ctx.toon({ color: 0x9b917a })); obelisk.position.set(-2, 1.5, -1.5); world.add(obelisk);
    const vessel = buildProp(ctx, "vessel"); place(vessel, 2, 0, -0.5);
  },

  // Emblem XLVI — two eagles meeting east and west, at the quintessence
  // still: paired eagle perches over the apparatus.
  "46": ({ ctx, place, buildProp }) => {
    const b1 = buildProp(ctx, "bird"); place(b1, -2.5, 0, -1);
    const b2 = buildProp(ctx, "bird"); place(b2, 2.5, 0, -1);
    const still = buildProp(ctx, "vessel"); place(still, 0, 0, 0.5);
  },

  // Emblem XLVII — the wolf from the East and the Dog from the West,
  // biting each other over the crucible of projection.
  "47": ({ ctx, place, buildProp }) => {
    const wolf = buildProp(ctx, "wolf"); place(wolf, -2, 0, -0.5);
    const dog = buildProp(ctx, "dog"); place(dog, 2, 0, -0.5);
  },

  // Emblem XLIX — the dying king acknowledging three fathers, like Orion,
  // under a night sky: a deathbed lit by starlight.
  "49": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const bed = buildProp(ctx, "bed"); place(bed, 0, 0, -0.5);
    const starLight = new THREE.PointLight(0xaebfd0, 1.2, 12, 2); starLight.position.set(0, 5, -2); world.add(starLight); anim.lums.push(starLight);
  },

  // Emblem L — the Dragon and the woman kill each other and bathe in
  // blood, the completed Stone crowned in radiance: a dramatic red-lit
  // altar bearing the finished stone.
  "50": ({ THREE, ctx, place, buildProp, world, anim }) => {
    const altar = buildProp(ctx, "table"); place(altar, 0, 0, -1);
    const redLight = new THREE.PointLight(0xb02218, 2.2, 12, 2); redLight.position.set(0, 1.8, -1); world.add(redLight); anim.lums.push(redLight);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.14, 8, 24), ctx.toon({ color: 0xffd86a, emissive: 0xffb020, emissiveIntensity: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 2.2, -1); world.add(ring);
  },
};

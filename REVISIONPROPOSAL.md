# REVISIONPROPOSAL.md

**Evaluation of the 3D emblem work in `C:\Dev\EMBLEMSIN3D` and `C:\Dev\3dprintlab`,
with a revised method and three worked examples.**

Written 2026-08-30. Everything below was checked against the running sites and the
actual data files, not against the READMEs. Where a doc and the data disagree, the
measured number is given and the disagreement is named.

---

## 0. What I actually looked at

| Evidence | Method |
|---|---|
| `scene.html?id=af-08`, `?id=af-01` | served from `C:/Dev` on :5184, loaded, screenshotted, console checked (no errors) |
| `gallery.html` | loaded, DOM measured live |
| `3dprintlab/app/index.html` | loaded, orbited, "distillation train" inspected |
| `EmblemPapercraft/data/layers.json` | parsed; per-emblem card counts computed |
| `EmblemPapercraft/images/cutouts/emblem-08/*`, `emblem-01/_backdrop.png` | opened directly |
| `EmblemPrintShop/assets/extracted_all/emblem-*/summary.json` | parsed, counted |
| Plates I, VIII, XXI | read as images and analysed for perspective structure |
| `papercards.js`, `scene.js`, `relief.js`, `spaces.js`, `build_layers.py`, `emblems3d.js` | read |

---

## 1. Verdict

**EMBLEMSIN3D's spatial method is currently a 2.5-D layer stack with a heuristic
depth channel, presented as a reconstruction of pictorial space. It is not one.**
The Stage 3 → Stage 4 move traded a wrong *content* model (primitive props) for a
right one (real cutouts), but in doing so it also discarded the only *spatial* model
the project ever had (the perspective armatures in `spaces.js`) and replaced it with
`depth = vertical_position − category_bias`. That formula contains no information from
the engraving's perspective construction. It is a painter's-algorithm z-order wearing
the costume of a depth reconstruction.

**3dprintlab's method is sound and its discipline is genuinely good** — provenance
ledgers, attested/conjectured status, mm units, print gates. Its weakness is the
opposite one: the objects are individually well-modeled and *spatially uncoordinated*.
Assemblies don't assemble.

Neither project currently has a **spatial correctness test**. Both have "does it run"
and "does it export" tests. That absence is the root cause of most of what follows.

### Six things that are true right now, verified

1. **30 of 51 emblems pop exactly one card.** Computed from `layers.json` using
   `papercards.js`'s own filter logic (unscored, minus `KNOWN_BAD`, plus the
   single-best fallback). Distribution: 1 card ×30, 2 ×8, 3 ×7, 4 ×4, 5 ×1, 7 ×1.
   Total across the whole book: **95 popped cards**. For 59% of the book the
   "walkable tunnel book" is a flat photograph of a page with one thing in front of it.

2. **The backdrop is a destructively holed scan of a whole book page.**
   `emblem-08/_backdrop.png` includes the leather binding, the page gutter, the
   letterpress epigram — and a **black rectangle** where the vault and the figure's
   torso were cut away. Because `papercards.js` then *excludes* those cutouts
   (`KNOWN_BAD` for `athanor_retort`, score-filter for `furnace`), the hole is never
   refilled. The flagship plate of the whole project renders with a void where its
   central architecture should be. This is visible in the very first screenshot of
   `scene.html?id=af-08`.

3. **The plate is anamorphically stretched ~37%.** `ROOM_W=16, ROOM_H=10` (aspect
   1.60) but `emblem-08` source is 1600×1373 (aspect 1.165). Every card and the
   backdrop are stretched by the same factor, so *relative* registration survives and
   the distortion is invisible from head-on — which is exactly why it has never been
   caught.

4. **Vertical registration is off by 14%.** Cards are placed with
   `y = EYE_BASE + (0.5 − cy) * EYE_SCALE` where `EYE_SCALE = 8.6`, but the backdrop
   spans `ROOM_H = 10`. A card's height comes from `nh * ROOM_H`. Position and size
   use different scales, so every card drifts toward the centre relative to the hole
   it came from.

5. **There is no perspective compensation for the pop.** A card moved from `BACK_Z`
   toward the viewer subtends a larger angle than the hole it left. Nothing shrinks
   it. This is why Boreas reads as a giant pasted over a small landscape in
   `scene.html?id=af-01` — the misregistration is *structural*, not a tuning error.

6. **The gallery loads 1,509 full-resolution JPEGs eagerly.** Measured live:
   `document.images.length === 1509`, `document.body.scrollHeight === 65106`, and
   after ~30 seconds only **103** had decoded. There is no thumbnail tier, no
   `loading="lazy"`, no IntersectionObserver. The page is functionally blank on first
   load.

Plus a data-integrity note offered neutrally: three different counts circulate for the
same corpus. `EmblemPapercraft/CLAUDE.md` says 743 labelled figures;
`EmblemPrintShop/data/visual_elements.json` holds 863 records; the live
`layers.json` holds 187 non-backdrop layers; and its declared source directory,
`EmblemPrintShop/assets/extracted_all/emblem-*`, **currently holds 151** — fewer than
the manifest built from it. The shipped manifest is stale with respect to its source.
I'm not asserting which number is canonical; I'm saying they should be reconciled and
one of them made authoritative before more work is built on top.

### 3dprintlab, specifically

The workbench renders and the UI is clean. Three observations from driving it:

- **The distillation train does not connect.** The alembic beak terminates in mid-air,
  angled *upward and away*, while the receiver sits on the ground plane a body-width
  off. This contradicts the project's own stated domain rule ("beaks droop… pelican
  arms return to the body," `ROADMAP.md` pillar 1) and its own catalog copy for the
  receiver ("its neck angles toward the beak"). A multi-part assembly whose parts
  don't meet is a spatial defect the print gates can't see, because each part is
  independently manifold.
- **Nothing is grounded.** No visible contact shadow or ambient occlusion; objects
  read as pasted onto the grid rather than resting on it.
- **Glass isn't glass.** The cucurbit and alembic are opaque green solids. Given how
  much of this corpus's visual identity is *seeing the work through the vessel*, this
  is a bigger loss than it looks.
- The "no CSG / openings as applied relief" rule is right for printing and wrong for
  viewing: furnace doors read as flat black rectangles. These are two different
  outputs and should be allowed to diverge (see R7).

---

## 2. Diagnosis: what the method is missing

The engravings are not layered images. They are **perspective constructions** — Merian
was working with a ruled ground plane, a horizon, and vanishing points. Emblem VIII's
paving grid is a metrology instrument sitting right there in the picture. The current
pipeline throws away every bit of that and substitutes `cy`.

Three specific missing concepts:

**(a) No ground plane.** Depth is inferred from where an object's *bounding-box centre*
sits vertically. The correct signal is where the object's **mask touches the ground** —
its foot line. A tall figure and a short figure standing on the same tile have wildly
different `cy` and identical depth.

**(b) No element taxonomy.** Every non-backdrop element is treated as a free-standing
card. But the plates contain at least five kinds of thing, and only one of them is a
card:

| Kind | Example | Correct treatment |
|---|---|---|
| **standing** | the adept, Boreas, the egg on the table | card (or geometry) at ground-contact depth |
| **attached** | Emblem XXI's inscribed circle/triangle/square | **decal on a reconstructed surface** — never a floating card |
| **architectural** | VIII's vault, XXI's brick wall, courtyard walls | built geometry; the space itself |
| **ornament** | Merian's rolled cloud-scrolls | parallax-free dome band; *not* an object |
| **page furniture** | binding, gutter, letterpress epigram, plate border | excluded from the scene entirely |

Every current failure is a misclassification under this table. The Emblem VIII vault
became a "card" (then a hole). The cloud scrolls become popped cards. The book gutter
became scenery.

**(c) No reprojection invariant.** There is no test that says: *from the engraver's own
station point, this 3D scene must look like the plate.* That single invariant would
have caught the black hole, the 37% stretch, the 14% drift, and the giant Boreas — all
of them, automatically, on the first run.

---

## 3. The revised method — "plate → space"

Replace `depth = cy − bias` with a five-stage pipeline. Stages 1–3 run offline in
EmblemPrintShop (Python/OpenCV, where the CV already lives); stages 4–5 are the
three.js runtime.

```
plate image
  │
  ├─1─ PERSPECTIVE SOLVE      → perspective/<plate>.json
  │    line-segment detect (LSD) → direction clustering → RANSAC vanishing
  │    points → horizon line → camera (station point, focal length, eye height)
  │
  ├─2─ CONTACT + TAXONOMY     → elements/<plate>.json
  │    per mask: foot line (lowest opaque run, not bbox bottom), contact
  │    confidence, and a HUMAN-ASSIGNED element_kind from the table above
  │
  ├─3─ BACKDROP REPAIR        → backdrops/<plate>.png
  │    crop to plate border (drop binding/gutter/letterpress), inpaint the
  │    holes left by extraction so the rear plane is continuous
  │
  ├─4─ SPACE ASSEMBLY (three.js)
  │    architectural elements → procedural geometry from the armature
  │    standing elements      → cards placed on the solved ground plane, scaled
  │                             so they subtend their original angle
  │    attached elements      → decals on the reconstructed surfaces
  │    ornament               → dome band
  │
  └─5─ REPROJECTION GATE
       render from the station point; overlay on the plate; assert alignment
```

### The load-bearing idea

Once you have the horizon line and one vertical vanishing direction, you have
**single-view metrology** (Criminisi/Reid/Zisserman): any point whose ground contact
is visible can be assigned a metric depth, and any object's height can be recovered as
a ratio against a reference height. You have a reference in almost every plate — a
standing human figure.

Then, for each card:

```
Z_world     = solved from the foot-line's position relative to the horizon
h_world     = h_pixels * Z_world / f          // f from the perspective solve
scale_pop   = (Z_station − Z_world) / (Z_station − Z_backdrop)
```

That last line is the fix for the giant-Boreas problem, and it's three lines of code.
A card popped forward is shrunk by exactly the amount that keeps its subtended angle
constant from the station point. Walk forward and the composition dissolves into
parallax; stand at the station point and it snaps back into the engraving. **That is
what a tunnel book actually does**, and it's what makes the peepshow illusion work.

### The reprojection gate (the single highest-value change)

Render the assembled scene from the solved station point with post disabled. Composite
against the source plate. Assert:

- every element's ground-contact point lands within *n* pixels of its plate position;
- no pixel of the rendered frame is background-void (catches every backdrop hole);
- mean luminance is within a declared band (catches the darkness);
- two consecutive renders are identical (catches `Math.random()` in `paperCard`).

This is exactly the "fixed-view visual contract" pattern from the
`threejs-visual-validation` skill, and this project is an unusually clean fit for it
because **the ground truth image already exists**. Most procedural-graphics projects
have to invent their visual contract. You have 51 of them, printed in 1617.

---

## 4. Revisions, prioritised

Each is scoped so it can ship on its own.

### R1 — Stop the bleeding (hours, not days)
- Set `EYE_SCALE = ROOM_H`. (14% drift, one line.)
- Derive `ROOM_W/ROOM_H` from the plate's real aspect instead of hardcoding 16×10.
- Add the `scale_pop` term above to every card.
- Move `scene.fog` near-plane out past the backdrop. Currently `near = 20` while the
  backdrop sits ~21 units from the spawn point — the rear wall of the tunnel begins
  fading the instant you look at it, which is a large part of why every scene reads
  near-black.
- Give the renderer explicit `toneMapping` + exposure. Right now the ink pass is
  simultaneously edge detector, vignette (×0.68 at corners), grain, and de-facto tone
  mapper. Separate those; see `threejs-exposure-color-grading`'s single-tone-map-owner
  rule.
- Seed the `Math.random()` in `paperCard`'s curl sign so renders are reproducible.
- Gallery: generate a 320 px thumbnail tier and add `loading="lazy"`. 1,509 eager
  full-res JPEGs is the entire reason that page appears broken.

### R2 — Repair the backdrops (the highest ratio of visible improvement to effort)
Stop cutting holes in the rear plane. Two changes to `build_layers.py`:
1. Crop to the engraved plate border; the binding, gutter, and epigram never enter the
   3D scene. (The epigram already has a proper home in the "Read the emblem" panel.)
2. Inpaint the extraction holes (`cv2.inpaint` for a first pass; LaMa if the
   architectural holes are large — VIII's is). The backdrop becomes a complete,
   continuous picture again, and popped cards sit *in front of* it rather than *in
   place of* it.

This alone makes it safe to exclude a bad cutout, which the current architecture
cannot do without punching a void.

### R3 — Add the perspective solve
New EmblemPrintShop stage producing `perspective/<plate>.json`:
`{ horizon_y, vanishing_points[], focal_px, station_point, eye_height_m, armature_type,
  confidence, reviewed_by }`. Automate with LSD + RANSAC; **review all 51 by hand**.
Fifty-one plates is small enough to do properly, and a wrong horizon poisons
everything downstream. Record confidence honestly, in exactly the spirit of
3dprintlab's `attested` / `conjectured` ledger — some plates (V, XXXVI) have almost no
usable perspective cue and should be marked as such rather than guessed.

### R4 — Add contact + taxonomy
Per element: foot line, contact confidence, and a hand-assigned `element_kind`.
~190 decisions across the whole book — an afternoon's work, and the single
highest-leverage manual step in this entire proposal. Fix the mislabels while you're
in there (emblem VIII's `pestle` is the **sword**; its `athanor_retort` is a robed
arm plus masonry, as `papercards.js`'s own comment already records).

### R5 — Rebuild the armatures properly
`spaces.js` was retired for the wrong reason. Its *contents* were wrong (primitive
props); its *premise* was right and is the thing the current version lacks. Bring it
back as a real procedural-architecture layer driven by R3's solved geometry rather
than by hand-tuned constants — massing grammar → exposed-surface graph → façade
placement, per the `threejs-procedural-architecture` skill. The armature types the old
file identified (interior box / walled court / figure landscape / diagram wall) were a
genuinely good taxonomy; keep them as the grammar's top-level rules.

**The hybrid HISTORY.md already names as "a natural next step" is the right target:**
armature geometry for the space, real cutouts for the figures. Build it.

### R6 — Let 3dprintlab supply the apparatus
111 of 238 layers in `layers.json` are category `equipment` — and equipment is
precisely what 3dprintlab models from period sources with a provenance record. The
adapter (`makeApparatus`, `apparatusForProcess`, `WORLD_HEIGHTS`) is already written
and its gate is only awaiting sign-off.

So: **figures stay cutouts; apparatus becomes geometry.** Don't cut the furnace out of
Emblem VIII at all — place 3dprintlab's `furnace` generator at the position the
perspective solve gives, at the scale `WORLD_HEIGHTS` gives. This simultaneously kills
the worst class of extraction failures (equipment cutouts are where all 110
low-confidence scores live), gives the walkable scenes objects you can walk *around*,
and finally makes the provenance ledger visible where someone might read it. It also
completes 3dprintlab's Phase 3 gate with a real consumer.

### R7 — 3dprintlab: separate the print target from the view target
- Add an assembly-constraint check: for multi-part generators, assert that connection
  points actually meet (beak discharge inside the receiver mouth, cucurbit rim inside
  the alembic skirt). This is a spatial gate to sit beside the existing print gates,
  and `threejs-procedural-geometry` covers exactly this failure class
  ("detached parts, interpenetration, clearance, swept-envelope defects").
- Fix the beak/receiver relationship in `train.js` — as shipped it contradicts the
  project's own domain rule.
- Add contact shadows + AO in the viewport only. Grounding is what makes a
  reconstruction legible.
- Give glass real transmission in the viewport; keep it a solid for export. The print
  path and the view path want different materials and should be allowed to say so.

---

## 5. Three worked examples

Coordinates below are **eyeballed from the plates as starting values for the solver,
not measurements**. The point is the shape of each reconstruction, not the digits.

### Example A — Emblem VIII, *"Take the egg and pierce it with a fiery sword"*
**Armature: one-point courtyard.** The flagship, and the plate that most rewards this
treatment because Merian handed you the instrument.

The paving is a regular square grid in one-point perspective, and the barrel vault at
left-centre recedes to the *same* vanishing point — the small lit doorway at roughly
(0.36, 0.44) normalised. So the horizon sits at y ≈ 0.44 and the tile joints give the
depth scale directly via the diagonal vanishing point. No estimation needed; it's a
ruled construction.

The adept's feet are at y ≈ 0.93, his head at y ≈ 0.17, and the horizon crosses him at
about 0.645 of his height — meaning **the station point is roughly 1.1 m, not 1.7 m.**
Merian drew this from a low viewpoint. The walkable camera should spawn at the solved
eye height and only then be allowed to rise; that's the difference between entering the
engraving and entering a different room that resembles it.

Assembly:

| Element | Kind | Treatment |
|---|---|---|
| paved courtyard | architectural | ground plane, tile pitch from the grid |
| barrel vault + lit door | architectural | **real walkable tunnel**, ~2.2 m × 12 m, emissive door at the far end |
| left arch + fire | architectural + vfx | arch geometry; fire as `threejs-procedural-vfx`, not a flat card |
| crenellated wall, church, town | architectural (far) | low-relief geometry or a far card past the wall |
| brick house block, right | architectural | façade bays from the grammar |
| table | standing | real plane at ~0.75 m — the egg must *rest* on it |
| egg | standing | 3dprintlab geometry, not a cutout |
| adept | standing | cutout card, foot-contact ~2.5 m from station point |
| sword | attached-to-figure | rigid child of the adept's card, not a free "pestle" |
| letterpress epigram, binding | page furniture | excluded |

Gate: from the station point, this must reproject onto the plate — the tunnel's
vanishing point landing on the lit door is a single-pixel test that validates the whole
solve. And there is no black rectangle, because the vault is *built*, not cut out.

### Example B — Emblem I, *"The wind carried it in its belly"*
**Armature: figure landscape** — the dominant type in the book (roughly half the
plates), so getting it right pays 25 times over.

Horizon = the waterline, y ≈ 0.60. Four depth bands, but only three of them are space:

1. foreground bank with shrubs and the serpentine root — 0–8 m, real ground
2. river, sailboat, walled town on its promontory, ruined arch — ~200–600 m
3. mountain range — kilometres
4. **rolled cloud-scrolls — ornament, not distance.** This is Merian's engraving
   convention, not weather. It belongs on a parallax-free dome band. The current
   pipeline's `CAT_BIAS` gives `sky` a recession of 0.42, i.e. it treats the scrolls as
   a thing standing at a depth. They should never move relative to the camera at all.

**The anomaly to preserve, not fix:** Boreas' feet contact the ground at ~2.6 m, but
his head is far above the horizon — he is deliberately colossal, drawn out of metric
scale with the landscape. The reconstruction must **keep** that and record it as an
attested pictorial fact, exactly the way 3dprintlab records a conjectured dimension. A
solver that "corrects" Boreas to human scale has destroyed the emblem's meaning. This
is where the two projects' scholarly values converge, and it's worth writing into the
schema as a first-class field (`metric_anomaly: "figure exceeds ground-plane scale;
deliberate"`), not a bug annotation.

**Aerial perspective should be graphic, not atmospheric.** Merian rendered distance by
*thinning his hatching* — the far town is drawn with fewer, lighter lines. So the
recession shader should modulate ink density with depth rather than blending toward a
fog colour. Take the structure from `threejs-atmosphere-aerial-perspective` (depth-based
transmittance, band-graded scattering) and drive line density with it instead of colour.
That produces recession that looks like an engraving rather than like a video game.

Also: foliage. Emblems I, II, VI and a dozen others are dominated by trees and shrubs
that are currently either flat cards or simply absent. `threejs-procedural-vegetation`
(leaf cards, recursive branches, rooted wind) is a direct fit, and the leaf-card
approach is *already* stylistically correct for engraved foliage.

### Example C — Emblem XXI, *the squared circle*
**Armature: two-point wall + surface decal.** The case that proves the taxonomy.

The brick courses recede leftward: this is a two-point plate, with a broad
frontoparallel wall face and an oblique return at the left. The philosopher stands at
the left with his dividers, feet at y ≈ 0.87. On the ground lie a set-square, a
conical protractor, and outlined polyhedra — all ground-contact objects whose
foreshortening independently constrains the ground plane, giving the solver a second
witness to check the wall solve against.

And the diagram — the great circle, the inscribed triangle, the square, the inner
circle with the man and woman — **is drawn on the wall.** It is not an object in the
courtyard. Under the current pipeline it becomes a floating card that pops forward and
detaches from the masonry, and you can walk behind Maier's central geometrical
argument. Under the revised method it is a decal projected onto the reconstructed wall
plane, and it stays welded to the brick from every angle.

This is the single most common misclassification in the corpus — anything inscribed,
painted, held, or engraved *within* the picture. Emblem XXI is the clearest instance,
so build it second, right after VIII, as the taxonomy's proving case.

Note the pleasing recursion: the inner circle containing the coupled figures is itself
a picture-within-the-picture, so it is a decal *on* a decal. Depth 0, forever. If the
system handles that correctly it handles the whole book.

---

## 6. Which of the three.js skills to use, and what they cost

The `scottstts/Threejs-Awesome-Graphics-Agent-Skills` set is installed locally at
`~/.claude/skills/threejs-*` — all 25 of them. Start with `threejs-skill-router`; it
exists to pick the minimum set for a given job. Mapping to this work:

| Skill | Where it applies | Priority |
|---|---|---|
| `threejs-visual-validation` | **the reprojection gate.** Fixed-camera contracts, no-post baselines, seed manifests, determinism. Would have caught every defect in §1. | **1** |
| `threejs-procedural-architecture` | R5's armatures — massing grammar → exposed-surface graph → façade bays → arches/cornices. Replaces `spaces.js`'s hand-tuned constants. | **1** |
| `threejs-exposure-color-grading` | fixes the darkness properly; enforces one tone-map owner instead of the ink pass doing four jobs | **1** |
| `threejs-image-pipeline` | pass ownership; lets post be disabled per-pass, which the gate requires | 2 |
| `threejs-shadow-systems` + `threejs-screen-space-ambient-occlusion` | cut-edge shadows are the entire legibility of a papercraft scene; grounding for 3dprintlab | 2 |
| `threejs-procedural-geometry` | 3dprintlab assembly checks — detached parts, interpenetration, clearance | 2 |
| `threejs-procedural-materials` | glass transmission for vessels; a real paper/ink material for cards | 2 |
| `threejs-atmosphere-aerial-perspective` | Example B's recession bands, repurposed as *graphic* aerial perspective | 3 |
| `threejs-procedural-vegetation` | the foliage that dominates half the landscape plates | 3 |
| `threejs-camera-direction` | the peepshow viewing cone; station-point framing; the Grand Tour's authored shots | 3 |
| `threejs-procedural-vfx` | VIII's arch fire, currently a flat card | 3 |
| `threejs-parallax-occlusion-mapping` | **the relief gallery.** Would replace `relief.js`'s 200×240-segment displaced plane with a height-field march: silhouette-aware, self-shadowing, height-derived normals, far cheaper across 1,500 plates. The best visual-quality win available — but see the cost below. | 3† |

**† The honest cost.** Both projects pin `three@0.160.0` via CDN import maps, buildless.
The POM skill (and much of the newer material in that repo) targets **WebGPU + TSL**,
which realistically needs a current three.js and a bundler. My recommendation:

- Keep WebGL/r160 as the shipping path for the emblem scenes. Nothing in R1–R6 needs
  WebGPU; the wins there are geometric and data-side, not shader-side.
- Add **Vite** (not Next.js) for the scene app when you want the newer skills' material.
  It preserves the ES-module authoring style, adds a version you control, and is a
  day's work.
- Consider a WebGPU branch **only** for the relief gallery, where POM's payoff is
  largest and the page is self-contained.

### On Next.js

I'd say no for the renderer, and a qualified maybe for the catalogue. The bottleneck in
EMBLEMSIN3D is spatial reconstruction and data quality; no framework addresses either,
and React Three Fiber would add a reconciler between you and code that is currently
pleasantly direct. The one place Next.js would genuinely earn itself is the
~1,500-plate gallery, where `next/image` solves the eager-load problem in §1.6 as a
side effect of existing, and file-based routes would give every plate a real URL. But
a thumbnail tier plus `loading="lazy"` gets ~90% of that benefit this afternoon,
without a migration. Do the cheap fix; revisit the framework only if the catalogue
grows a search/faceting layer that wants a server.

---

## 7. Proposed gates

Add to both projects, and make them the definition of "done":

1. **Reprojection gate** — render from the station point, no post; every element's
   ground contact within *n* px of its plate position. Per emblem, 51 of them.
2. **No-void gate** — no background-coloured pixel in the station-point frame. Would
   have blocked the Emblem VIII black rectangle on day one.
3. **Page-furniture gate** — no binding, gutter, or letterpress pixels in any scene
   texture.
4. **Exposure gate** — hero-view mean luminance inside a declared band; no-post
   baseline captured alongside.
5. **Determinism gate** — two consecutive renders identical.
6. **Assembly gate (3dprintlab)** — declared connection points of multi-part
   apparatus actually meet.
7. **Gallery perf gate** — time-to-first-paint with the full catalogue, measured, with
   a number.

Gate 1 is the one that matters. The other six are cheap once the harness for it exists.

---

## 8. Suggested order

| # | Work | Effort | Unlocks |
|---|---|---|---|
| 1 | R1 quick fixes + gallery thumbnails | hours | site stops looking broken |
| 2 | Reprojection gate harness (bare, on the current scene) | 1 day | every later claim becomes checkable |
| 3 | R2 backdrop repair | 1 day | removes the voids; makes exclusion safe |
| 4 | R3 perspective solve, all 51 reviewed by hand | 2–3 days | the actual missing science |
| 5 | R4 contact + taxonomy, ~190 hand decisions | 1 day | cards stop floating; decals become possible |
| 6 | R5 armatures for VIII, I, XXI | 3–4 days | the three worked examples, shippable |
| 7 | R6 3dprintlab apparatus into the scenes | 2 days | kills the worst extraction failures; closes 3dprintlab Phase 3 |
| 8 | R7 3dprintlab assembly + viewport gates | 2 days | assemblies assemble |
| 9 | POM relief gallery (WebGPU branch) | optional | best visual win, highest cost |

Steps 1–3 are worth doing regardless of whether you accept the rest of this document;
they are repairs to what's already shipped. Step 4 is the decision point — it's where
this stops being a layer stack and becomes a reconstruction.

---

## 9. One thing to keep

The instinct behind Stage 4 was right and should survive all of this: **the figures
must be the actual engraved cutouts.** Every synthetic-primitive version of this
project failed, twice, for the same reason, and the history page is honest about it.
Nothing above proposes redrawing a single figure. The proposal is that the *space*
those real cutouts stand in should be reconstructed with the same fidelity the cutouts
themselves already have — and that the engravings, being ruled perspective
constructions, tell you exactly how to do it.

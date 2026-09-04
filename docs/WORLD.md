# The Fugitive World — Phase 7

*One walkable world of all fifty-one emblems of Michael Maier's* Atalanta Fugiens
*(1617), with free walking and a guided tour.*

Open `site/world.html`. Locally:

```bash
python -m http.server 5184 --directory C:/Dev
```

then <http://localhost:5184/EMBLEMSIN3D/site/world.html>. Deep links:
`?station=8` starts you outside Emblem VIII, `&tour=1` begins the guided tour
there, `&route=process` walks it in the order of the work, `&sound=1` turns on
the fugues.

---

## 1. What it is

A single road — **the course** — walked in emblem order from the title page to
Emblem L, with fifty-one stations along it. Each station is three registers
stacked in one local frame whose origin is on the ground at the plate's own
station point:

| register | what it is | invented? |
|---|---|---|
| **the setting** | generated period architecture and landscape for the archetype `locations.js` reads off Maier's own epigram — laboratory, courtyard, farm, riverside, kitchen, temple, castle… | yes, and labelled so |
| **the threshold** | an arch and a letterpress cartouche carrying the number, the motto, and the station's tier | yes |
| **the diorama** | the plate itself, at one of two tiers | measured, or labelled conjecture |

The conceit is Maier's, not an invented hub. The book *is* a race — Hippomenes
chases Atalanta, the reader chases fleeting truths, the fifty fugues are all
canons of pursuit — so the connective tissue is a track you walk, and the
threshold arch is the visible boundary between the invented world outside it
and the reconstruction inside it.

## 2. Two tiers, and the difference is visible

Phase 6's armature router established that only 5 of the 51 plates have a
recoverable horizon, and building this world removed one of those five. The
count is **4 measured, 47 not**, and the world does not paper over that.

The plate that was removed is worth stating, because it is a finding. Emblem
XXIV's automatic two-vanishing-point solve reports *f* = 197 px on a 1408 px
plate — a **149° vertical field of view**. No perspective construction in this
corpus, or in any other, was drawn through a lens like that; the orthogonality
fit is spurious. `tools/build_world.py` therefore admits a solve to the
measured tier only if the lens it implies falls in a stated plausible band
(15°–70° vertical; the three hand-measured plates sit at 27.8°, 43.3° and
43.4°), and records the rejection in the station's panel rather than clamping
the number quietly. That is the same rule Phase 5 applied when it rejected
Emblem VIII's weak distance-point cluster instead of adopting it.

Of the four that remain, three (I, VIII, XXI) are hand-measured and reviewed;
XLV came out of the automatic pass and has not been checked by a person, which
its panel says.

**`measured`** — Emblems I, VIII, XXI and XLV. A room. Every depth comes
from that plate's own pinhole,

```
Z = f · E / (y − horizon)        size = px · Z / f
```

applied at each element's measured ground contact, exactly as Phase 5's
`reconstruct.js` does. Stand on the brass disc at the station point, press
<kbd>G</kbd>, and the source plate is drawn over the render at 50 %: **the
reprojection gate, now available from inside the world.** The camera adopts
that plate's focal length and eye height to make it a real test — Emblem VIII
is viewed at fov 27.8° from an eye height of 1.09 m, because that is what the
solve says.

**`conjectural`** — the other 47. A flat. The plate stands as a cut sheet and
its cutouts pop forward in *parallel* projection, so apparent size never
changes and the reconstruction claims nothing about depth. Pressing <kbd>G</kbd>
here says so: *"this plate has no recoverable horizon, so there is nothing to
reproject: the gate is not a test here, only a comparison."*

This is deliberate. The project's progress is legible as terrain: as review
work converts a plate from conjecture to measurement, a flat becomes a room.

## 3. The hatching is Merian's own

`tools/build_hatch_tam.py` scans every 256 px window of all 51 engravings and
measures two things per window: the **ink fraction** after a per-plate Otsu
threshold (that is tone), and the **structure-tensor coherence** (that is how
purely the window is parallel burin work, rather than a face or foliage or
cross-hatched mush). For each of six tone bins it keeps the most coherent
passage in the whole book, makes it seamlessly tileable with an
offset-and-cross-fade — which preserves stroke direction, where a mirror would
not — and writes the six as one strip.

What came out, with provenance, in `site/assets/hatch/tam.json`:

| bin | measured tone | coherence | cut from |
|---|---|---|---|
| 0 | 0.085 | 0.932 | emblem-45, window (128, 512) |
| 1 | 0.118 | 0.938 | emblem-45, window (128, 384) |
| 2 | 0.229 | 0.949 | emblem-43, window (896, 0) |
| 3 | 0.383 | 0.961 | emblem-17, window (896, 0) |
| 4 | 0.523 | 0.900 | emblem-42, window (640, 0) |
| 5 | 0.705 | 0.755 | emblem-24, window (896, 768) |

`site/js/world/hatch.js` uses that strip as a **tonal art map** in the sense of
Praun, Hoppe, Webb and Finkelstein's *Real-Time Hatching*: the two tiles
bracketing a fragment's tone are blended per fragment, so density tracks
shading with spatial and temporal coherence that a screen-space filter cannot
give. Mapping is triplanar in world space, which means procedural geometry
needs no UVs and the hatch stays welded to the world instead of swimming as you
walk.

The consequence is the point of PROPOSAL_PHASE6 §3: **a wall in this world is
shaded with strokes Merian actually cut, at the density his hand used for that
darkness.** Built geometry and drawn cutouts are the same substance, which is
what three earlier attempts at synthetic props could never achieve.

There are no shadow maps. An engraving shades with hatching, not with a cast
shadow; the material owns its own tone, and grounding comes from a soft contact
patch under each station.

## 3b. Three routes through one terrain

The road is laid out in emblem order because that is the book. A route does not
move a station; it chooses the order the tour visits them.

| route | what it is |
|---|---|
| **Emblem order** | the book as Maier printed it, title page to Emblem L |
| **Order of the work** | the same fifty-one stations regrouped by the operation each one stages — `emblemdata.js` tags every emblem — sequenced by **Ripley's twelve gates**: calcination (11 stations), solution (13), separation (5), conjunction (1), putrefaction (3), congelation (7), fixation (1), digestion (1), fusion (1), fermentation (4), multiplication (3), projection (1) |
| **Free explore** | no tour; the panel follows whichever station you stand in |

On the process route consecutive stops can be half a kilometre apart, so the
handoff duration scales with distance rather than being a fixed 2.6 s.

## 3c. The commentary arrives in levels

Nine archetypes, nine colours, so you can see which register you are in without
reading a paragraph to find out: `motto`, `epigram`, `image`, `discourse`,
`dejong`, `historical`, `alchemical`, `myth`, `register` — plus `solve` for the
geometry. Mean twelve boxes per station, range six to twenty-five.

The **`register`** boxes are the distinctive ones. The Claudiens dictionary
carries a `registers` column that reads one figure four ways at once — *in the
laboratory*, *in the body*, *in the soul*, *in the heavens* — and a hundred of
the term-to-emblem links have all four. That is "the allusion unpacked" in the
form the corpus actually holds it.

## 3d. The fugues

*Atalanta Fugiens* is fifty three-voice canons as much as fifty engravings.
`chiptune.js` renders each through an NES-APU-style synth: two pulse channels
plus a triangle bass, one per canon voice, which is what the three tonal NES
channels are for, cycling the CODEXSYNTH game palettes as the canon repeats.
The station you are standing in plays its own. Off until asked (<kbd>M</kbd>),
because a page that starts making noise unbidden is a page people close.

## 4. The stage colour is a gradient, not four districts

NIGREDO → ALBEDO → CITRINITAS → RUBEDO is **not** monotonic in emblem order:
III is albedo, IV–V fall back to nigredo, X is citrinitas, XI–XIII albedo
again, and rubedo only runs clean from XXVII. Rather than reorder the book or
assert a partition it does not have, ground tint, sky and aerial fade lerp
along the road toward each station's own stage. Walking the course therefore
feels the oscillation the book actually has.

The tints stay high-key on purpose: an engraving is ink on a light sheet even
at its blackest, and a NIGREDO that reads as night stops reading as a print.

## 5. Camera: one camera, explicit ownership

`site/js/world/camera.js`. Free walking (pointer lock) and the guided tour
share one camera. Projection ownership is explicit and is printed in the
diagnostics overlay:

```
owner "world"      fov 62°, eye 1.62 m           free walking
owner "plate:08"   fov 27.8°, eye 1.09 m         at Emblem VIII's station point
```

Every transfer between owners is **one** interpolation stage — lerp position,
slerp orientation, lerp fov, then return from the frame. Stacking a follow
smoother on top of a transition is the standard way to get a mid-transition
half-halt, so nothing else runs while a handoff is in flight. Pointer-lock
acquisition re-syncs yaw and pitch from the camera, because whatever moved it
while unlocked — a tour, a teleport — is now the truth.

## 6. Controls

| | |
|---|---|
| click | take pointer lock and walk |
| W A S D | move · <kbd>shift</kbd> hurry · <kbd>Q</kbd>/<kbd>E</kbd> stoop and rise |
| <kbd>F</kbd> | stand exactly at the station point and take that plate's lens |
| <kbd>G</kbd> | reprojection gate — off / plate at 50 % / plate only |
| <kbd>T</kbd> | guided tour · <kbd>space</kbd> hold · <kbd>esc</kbd> step off |
| <kbd>P</kbd> | the reading panel |
| <kbd>M</kbd> | this station's fugue, on or off |
| <kbd>[</kbd> <kbd>]</kbd> | close and open the book (collapse and restore the pop) |
| <kbd>`</kbd> | diagnostics: camera owner, fov, eye, stage, tier, module and triangle counts, draw calls, loaded plates, handoff progress |

## 7. Where the words come from

Nothing in the narration is written by the renderer. `tools/build_world.py`
compiles `site/data/world.json` from `C:/Dev/Claudiens/db/atalanta.db`:

- `emblems` — motto (Latin and English), epigram, discourse summary,
  alchemical stage and its palette;
- `scholarly_refs` ⋈ `bibliography` — de Jong 1969 first, then Craven and the
  others, each with its recorded page;
- `emblem_sources` ⋈ `source_authorities` — the alchemical, classical,
  biblical, hermetic and patristic texts each discourse cites, which is the
  "what story is this drawing on" panel;

joined to this repository's `data/perspective.json` (the armature class and the
solve, or an honest refusal), `data/elements.json` (cutouts with measured
ground contacts) and `site/assets/manifest.json`.

Every panel carries its provenance line, because most of these rows are
`CORPUS_EXTRACTION` / `DRAFT` and have not been read by a human scholar. That
is the state of the record, and good typography is not a reason to hide it.

## 8. Costs, measured

Per station: 260–1030 triangles of setting, 3–5 draw calls. Plate textures
stream — the nearest eleven stations along the route stay resident, the rest
fall back to blank sheets — because 51 plates at full size is roughly 250 MB of
GPU memory. A measured station's backdrop is the plate at 20 m and so is 12 m
tall, which reads as a billboard from the road, so the diorama is shown only
from inside the bay; from outside you see the setting, which is the point.

## 9. What it does not do yet

- **Cards are flat.** Walk to the side of a station and figures thin to a line.
  PROPOSAL_PHASE6 §6 is the fix: amodal completion of the backdrop behind a
  popped element, then a shallow relief shell driven by the hatching normals.
- **The backdrop still contains what was popped out of it.** A lifted figure is
  still drawn in the plate behind it. The corpus-specific fix is to register the
  hand-coloured page scan against the b/w Claudiens scan so the occluded pixels
  are *cited* rather than hallucinated.
- **47 of 51 stations are conjectural.** The equal-height horizon construction
  that would solve most of them is now implemented
  (`tools/equal_height_horizon.py`) and wired into the review app as a
  click-to-mark canvas — click a head, then that figure's foot, twice, and the
  horizon is drawn with its residual. What it still needs is a person going
  through the plates. Automatic figure recall remains blocked upstream in
  EmblemPrintShop (five figure detections across 51 plates full of people).
- **No collision.** You can walk through a wall or a plate.
- **The settings are archetypes, not reconstructions.** A laboratory is a
  generic 1600-ish laboratory, not the laboratory in the plate. It stands
  outside the threshold arch for exactly that reason.

## 10. Files

```
tools/build_world.py        -> site/data/world.json     content + metric placement
tools/build_hatch_tam.py    -> site/assets/hatch/       the TAM, with provenance
tools/equal_height_horizon.py  marked figures -> horizons, with residuals
site/world.html             the page
site/css/world.css          paper, ink, and as little chrome as possible
site/js/world/main.js       wiring, streaming, the gate, diagnostics
site/js/world/course.js     road, ground, horizon, sky, the stage gradient
site/js/world/station.js    one station: setting, threshold, diorama, streaming
site/js/world/settings.js   the 15-archetype kit: plan -> compile, zoned
site/js/world/camera.js     one camera, three owners, explicit handoffs
site/js/world/hatch.js      the tonal-art-map hatching material
site/js/world/narration.js  the nine colour-coded commentary levels
site/js/world/vendor/       chiptune.js + gamesynths.js, vendored to publish
```

Built with the [Threejs-Awesome-Graphics-Agent-Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills)
pack: `threejs-skill-router` to choose, `threejs-camera-direction` for the
projection-ownership and handoff rules, `threejs-procedural-architecture` for
the plan-then-emit boundary and the material-slot mesh writer, and
`threejs-procedural-materials`' tonal-art-map treatment for the hatching.

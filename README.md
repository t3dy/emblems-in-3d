# Emblems in 3D

Turning the emblems of Michael Maier's *Atalanta Fugiens* (1617) into walkable 3D
environments with [three.js](https://threejs.org/), rendered in a toon/woodcut style
to echo the original engravings.

## → The live site: **<https://t3dy.github.io/emblems-in-3d/>**

**Phase 7 — The Fugitive World.** All fifty-one emblems in **one** walkable world:
a single road walked in emblem order, fifty-one stations along it, free walking and a
guided tour, carrying Maier's motto and epigram, de Jong's readings, and the alchemical
and classical sources each discourse draws upon.

- **[The Fugitive World](site/world.html)** — the world itself
  (`?station=8` to start at a given emblem, `&tour=1` to begin the tour there,
  `&route=process` to walk it in the order of the work, `&sound=1` for the fugues)
- **[`docs/WORLD.md`](docs/WORLD.md)** — how it is built and what it refuses to claim

The book *is* a race, so the connective tissue is a course you walk rather than a
gallery you browse. Each station's threshold arch is the visible boundary between the
invented world outside it and the reconstruction inside it, and the two tiers of
station are visibly different:

- the **4 plates with an admissible solve** (three of them hand-measured) are rooms —
  every depth from that plate's own pinhole, and the reprojection gate (<kbd>G</kbd>)
  still a real test from inside the world, because the camera takes that plate's focal
  length and eye height;
- the **47 without one** are flats — the plate as a cut sheet whose cutouts pop in
  *parallel* projection, so no depth is claimed at all.

Building it produced a finding of its own: Emblem XXIV's automatic solve implies a 149°
vertical field of view, which is not a perspective construction but a spurious
orthogonality fit, so the world rejects it — out loud, in the station's panel — rather
than clamping the number quietly.

Three ways through: **emblem order** (the book as Maier printed it), **order of the
work** (the same fifty-one stations regrouped by the operation each stages, sequenced
by Ripley's twelve gates — the road does not move, only the reading does), and **free
explore**. The commentary arrives in nine colour-coded levels — Maier's motto and
epigram, what Merian engraved, Maier's discourse, de Jong's analysis, the other
scholars, the alchemical text being cited, the myth being alluded to, and the same
figure unpacked in four registers at once: in the laboratory, in the body, in the
soul, in the heavens. And each station plays its own three-voice canon through an
NES-APU synth, because the book is fugues for the ears as much as emblems for the
eyes.

Built geometry is shaded with a tonal art map whose six hatch tiles are **cut out of
Merian's own plates** — the most orientation-coherent passage of burin work in the
whole book at each of six ink densities, with the plate and pixel window of each
recorded in `site/assets/hatch/tam.json`. A wall and a cutout are therefore the same
substance.

---

## Phase 5 — Reconstruction

The measurement layer everything above rests on, published as a static site: the three
worked examples, all 51 perspective solves drawn back onto their engravings, the
method, and an honest account of what the previous version got wrong.

- **[Overview](https://t3dy.github.io/emblems-in-3d/)**
- **[The three examples](https://t3dy.github.io/emblems-in-3d/examples.html)** —
  Emblem VIII (a one-point courtyard with a walkable vault), Emblem I (Boreas, three
  depth registers), Emblem XXI (a frontal wall carrying its diagram as a decal)
- **[All 51 plates](https://t3dy.github.io/emblems-in-3d/plates.html)** — every solve,
  with the numbers, and which ones are weak
- **[Method](https://t3dy.github.io/emblems-in-3d/method.html)**
- **[What was wrong](https://t3dy.github.io/emblems-in-3d/findings.html)**

---

## Phase 5 in one paragraph

Merian's engravings are ruled constructions: he worked from a horizon and one or two
vanishing points, and the paving grids, wall courses and cornices are still in the
picture. Earlier versions of this project ignored all of that and set each figure's
depth with `depth = vertical_position − category_bias − 0.15·area`, which contains no
information about perspective at all. Phase 5 replaces it with the plain pinhole
relation for a camera of focal length *f* at eye height *E* looking at a flat ground
plane —

```
Z = f · E / (y − horizon)
```

— applied to where an element's mask **touches the ground** rather than to where its
bounding box happens to be centred. Sizes follow from the same relation, so a card
always subtends the angle it subtends in the engraving. Setting the 3D camera to the
same *f* and *E* then makes the result testable: the reconstruction must reproject
onto the plate it came from. That is the **reprojection gate** (press <kbd>G</kbd>),
and it is the check this project never had.

Full evaluation of this project and of `../3dprintlab`, with the ordered revision plan
and a mapping onto the three.js graphics skills, is in
**[`REVISIONPROPOSAL.md`](REVISIONPROPOSAL.md)**.

## The pipeline

Everything on the published site is generated. Nothing is hand-placed except three
hand-measured perspective solves, and those live in a reviewable override file.

```bash
python tools/solve_perspective.py      # -> data/perspective.json
python tools/build_elements.py         # -> data/elements.json + site/assets/cutouts/
python tools/build_web_assets.py       # -> site/assets/{plates,ground}/ + manifest.json
python tools/render_solve_overlay.py   # -> site/assets/solve/   (the review artifact)
python tools/build_site_pages.py       # -> site/plates.html, site/examples.html
python tools/build_hatch_tam.py        # -> site/assets/hatch/   (the TAM + provenance)
python tools/build_world.py            # -> site/data/world.json (the walkable world)
python tools/equal_height_horizon.py   # marked figures -> horizons (add --write)
```

| File | Job |
|---|---|
| `tools/solve_perspective.py` | Canny → Hough → RANSAC vanishing points → horizon. Focal length from the orthogonality constraint `f² = −(v₁−c)·(v₂−c)` where two opposed VPs exist; `ASSUMED` and labelled where not. |
| `tools/build_elements.py` | Foot lines with a confidence and a stated basis, plus the five-way element taxonomy. Re-cuts every cutout from the same plate its mask was made from. |
| `tools/build_web_assets.py` | Self-contained plates, and an inverse-perspective warp of each ground region into a walkable top-down texture. |
| `site/js/reconstruct.js` | Station-point camera, angle-preserving pop, taxonomy dispatch, three-state reprojection gate. |
| `site/js/armatures.js` | The three worked examples, built on one primitive (`plateBand`). |
| `tools/build_hatch_tam.py` | Scans all 51 plates for the most orientation-coherent passage of burin work in each of six tone bins, and writes them as a tileable tonal art map with a provenance record. |
| `tools/build_world.py` | Joins the Claudiens DB (mottos, epigrams, discourses, de Jong's readings, the cited authorities) to the solves and the cutouts, precomputes each station's metric placement, and emits one `world.json`. |
| `tools/equal_height_horizon.py` | The Criminisi/Reid/Zisserman equal-height construction: two figures of the same height on one ground plane fix the horizon with no assumption about how tall anyone is. Reads the marks a person makes in the review app. |
| `site/js/world/` | The Fugitive World — see [`docs/WORLD.md`](docs/WORLD.md). |

Hand review lives in `data/perspective.overrides.json` and `data/elements.overrides.json`
and always wins over the automatic pass.

## The local review app

A full-stack accept / reject / note loop, in the same spirit as EmblemPrintShop's
review page but with one difference that matters: **it writes to disk**, and the
writes feed the pipeline rather than sitting beside it.

```bash
python review/serve.py
```

Then open <http://localhost:8770/review/>. For each plate you get the perspective solve
drawn onto the engraving, the live reconstruction in a frame, and the element table.

- **Accept / Reject / Note** → `review/decisions.json`
- **Change an element's kind** → `data/elements.overrides.json`, then re-run `build_elements.py`
- **Place the horizon by hand** → `data/perspective.overrides.json`, then re-run `solve_perspective.py`
- **Mark two standing figures** (click a head, then that figure's foot) → the
  equal-height construction returns the horizon live, with its residual and the
  fraction of each figure's height it cuts; “Save + set horizon” writes it to
  `data/figures.json` and the overrides. This is the way to convert the 47
  unsolved plates into walkable rooms, and it needs no architecture and no
  assumption about anyone's height.

## Honest status

Three of the 51 solves are hand-measured; five in all carry a horizon the armature
router was willing to report, and one of those five (Emblem XXIV) is rejected by the
world's lens-plausibility check, leaving four. The remaining 47 honestly return "no
horizon recoverable". Of the automatic solves most are weak — only 10 reach a confidence of
0.25. The reason is worth stating plainly: dense
engraved hatching is thousands of short parallel line segments and it swamps a
Hough-and-RANSAC vanishing-point search. The automatic pass is a first draft that a
person has to correct, which is exactly what the review app is for.

Wherever a quantity could not be measured, the record says `ASSUMED` and gives the
reasoning. Emblem VIII's focal length carries both failed attempts to measure it
rather than a plausible substitute.

---

## Earlier phases (local server only)

The rest of the site — the relief gallery, the Great Work tour, the fugue jukebox, the
Laboratory experiments, the papercraft scenes — predates Phase 5 and loads its images
by absolute path from a server rooted at `C:\Dev`, so it does not work on GitHub Pages.
To run it:

```bash
cd C:/Dev && python -m http.server 5184
```

- gallery: <http://localhost:5184/EMBLEMSIN3D/gallery.html>
- Phase 5: <http://localhost:5184/EMBLEMSIN3D/site/index.html>
- development history: <http://localhost:5184/EMBLEMSIN3D/history.html>

**→ [Development history](history.html) / [`docs/HISTORY.md`](docs/HISTORY.md)** — the
per-emblem scene system went through several genuinely different implementations,
including two that were wrong and got replaced after direct feedback. Phase 5 is the
fourth correction, and [what it corrected](https://t3dy.github.io/emblems-in-3d/findings.html)
is documented rather than quietly replaced.

## Gallery of all plates (`gallery.html`)

Every plate of both books is browsable and gets a generated 3D **carved relief**: the
engraving drives a displacement map on a finely-subdivided plane, so the light paper
stands proud and the dark lines are incised.

- **51 Atalanta Fugiens** emblem plates (Maier, 1617) + **162 Hypnerotomachia
  Poliphili** woodcuts (Colonna, 1499) = **213 models**, plus the ~1,300-plate
  OCCULTIMGDB alchemy family.
- Grid hub with book filter + title search; click any plate to inspect its relief.

> Known defect, measured: this page creates 1,509 full-resolution `<img>` elements
> eagerly and is functionally blank on first load. Fix queued — see
> [What was wrong](https://t3dy.github.io/emblems-in-3d/findings.html) §6.

## The Great Work — cinematic tour (`grandtour.html`)

A press-play, on-rails flight through the emblems in alchemical order (nigredo →
albedo → citrinitas → rubedo), with UnrealBloom, drifting embers, per-stage title
cards, and each emblem's actual fugue rendered in 8-bit as the camera reaches it.

## 8-bit fugues (`chiptune.js`, `jukebox.html`, `fugue.html?n=NN`)

*Atalanta Fugiens* is a book of 50 three-voice canons. Their note data is rendered
through an NES-APU-style synth — two pulse channels plus a triangle bass — so the
fugue's three voices map straight onto the three NES tonal channels. Each emblem's
page cycles the fugue through ten NES "synth palettes" mined from nsfripper's
CODEXSYNTH bench, with an accordion of de Jong's scholarship imported from the
Claudiens DB.

## The Laboratory — alchemical experiments (`experiments.html`)

Small experiments that turn an emblem's *call to action* into something you watch or
play, each with an essay on the design logic and a working Canvas2D artifact.

## The Atalanta Fugiens family

| Project | What it does | Local |
|---|---|---|
| Emblems in 3D | this project | — |
| Emblem Papercraft | the same plates as shadow-casting paper pop-ups | `../EmblemPapercraft/` |
| Emblem Roguelike | a Dragon-Warrior-style RPG made from the extracted engravings | `../EmblemRoguelike/` |
| Emblem Novel | graphical text adventure built from the emblems | `../EmblemNovel/` |
| Atalanta Claudiens | DH site on de Jong's scholarship — source of the plates used here | `../Claudiens/` |
| Emblem Print Shop | the CV pipeline that cut the figure masks | `../EmblemPrintShop/` |
| 3dprintlab | printable period apparatus, provenance-tracked | `../3dprintlab/` |

## Sources

Michael Maier, *Atalanta Fugiens*, Oppenheim 1617, engraved by Matthäus Merian.
Francesco Colonna, *Hypnerotomachia Poliphili*, Venice 1499. Cutout masks from
EmblemPrintShop's GroundingDINO + SAM pipeline, re-cut in Phase 5 against the same
source plates.

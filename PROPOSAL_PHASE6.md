# PROPOSAL — Phase 6: the armature router, and reading the marks correctly

**Project:** `C:\Dev\EMBLEMSIN3D`
**Written:** 2026-08-31, after Phase 5 shipped
**Companions:** `../EmblemPrintShop/PROPOSAL_EXTRACTION_V2.md`,
`../EmblemPapercraft/PROPOSAL_BUILDABLE.md`, `../3dprintlab/PROPOSAL_MULTIWITNESS.md`

Phase 5 replaced a heuristic depth channel with real single-view metrology and gave the
project a reprojection gate. It worked, and the gate immediately did its job. This
proposal is about the two things the gate and the data then exposed, plus five methods
from the literature that this corpus is unusually well suited to.

Everything below marked **[measured]** was tested against the actual plates today.
Everything marked **[proposed]** has not been built.

---

## 1. The finding that reorganises the whole solver

I tested three hatching-suppression strategies against the three hand-measured plates.
**[measured]**

| plate | truth (horizon ny) | baseline | coarse ¼-scale | texture-suppressed |
|---|---|---|---|---|
| **VIII** (ruled courtyard) | 0.455 | 0.274 · err **0.181** | 0.469 · err **0.014** | 0.390 · err 0.065 |
| **XXI** (frontal wall) | 0.286 | 0.602 · err 0.316 | 0.877 · err 0.591 | 0.531 · err 0.245 |
| **I** (landscape) | 0.570 | 0.678 · err 0.108 | 0.145 · err 0.425 | 0.749 · err 0.179 |

Read that carefully, because the two halves say opposite things.

**On the ruled plate, hatching really was the problem, and scale space essentially
solves it.** Detecting lines on a ¼-scale plate — where the burin hatching blurs into
tone and only the long construction lines survive — drops the horizon error from 0.181
to **0.014**. That is within a hair of the hand measurement, and it cost one
`cv2.resize`. The current solver is not broken so much as looking at the wrong
frequency band.

**On the other two plates every variant fails, and it is not the detector's fault.**
Emblem XXI's wall is *frontoparallel*: it has no vanishing point, which is precisely
why its great circle reads as a true circle. Emblem I is a landscape with no
architecture at all. The solver is confidently answering a question those plates do not
pose. Better line detection cannot fix that, and dressing the answer up with a
confidence score just makes a category error look like a measurement.

### The proposal: classify the armature first, then choose the estimator

```
plate
  ├─ ruled interior / court   → vanishing-point estimation (multi-scale + recurrence)
  ├─ frontoparallel surface   → NO VP. Horizon from figures; wall depth from a
  │                             known-height reference; decal geometry
  └─ figure landscape         → NO VP. Horizon from the water/ground boundary and
                                from standing figures; depth registers, not a plane
```

Detection is cheap and mostly negative evidence:

- **Frontoparallel** — the dominant long-line orientations cluster at 0° and 90° with
  no convergence; drawn circles stay circular (fit ellipses to closed contours and test
  eccentricity — Emblem XXI's great circle is the discriminator, and it is *in the
  picture*).
- **Landscape** — a long, near-horizontal tonal discontinuity spanning most of the
  width (the waterline / far shore), low straight-line density, high foliage texture
  energy.
- **Ruled** — everything else; only here does a VP mean anything.

Then estimate per class, and **let a class return "no horizon recoverable"** rather
than a number. Phase 5 already has the honest-reporting machinery; this gives it
something honest to report.

### The estimator the landscape and wall classes actually need

For a plate with two or more standing figures of similar height on one ground plane,
the horizon is recoverable **exactly, with no assumption about how tall anyone is**: the
line through their heads and the line through their feet meet at a point on the
horizon. Two such pairs give the horizon line outright. This is the classical
equal-height construction behind
[Criminisi, Reid and Zisserman's single-view metrology](https://www.robots.ox.ac.uk/~lav/Papers/criminisi_etal_ijcv2000/criminisi_etal_ijcv2000.html),
and it is exactly the tool for a corpus where the architecture is unreliable but the
staffage is everywhere.

**It is currently unusable, and the reason is upstream.** Across all 51 plates the
extraction pipeline has found **five** figure detections; 48 plates have none.
**[measured]** The categories are 120 equipment, 18 architecture, 5 figures, 3 objects,
2 plants, 2 landscape. Every plate in this book is full of people — the swordsman,
Boreas, the philosopher, the washerwoman, the coupled king and queen — and the detector
sees almost none of them.

So the single highest-leverage change for *this* project's geometry is not in this
project. It is fixing figure recall in EmblemPrintShop
(`../EmblemPrintShop/PROPOSAL_EXTRACTION_V2.md` §1). Until then the horizon has to be
placed by hand, which is what the review app is for.

---

## 2. We have been reading the marks backwards

`relief.js` builds every gallery model by driving a displacement map from the plate's
luminance: light paper stands proud, dark ink is incised, "the picture is literally
carved into geometry." It is a lovely effect and it is **semantically inverted**.

In an engraving, ink density is not height. It is *tone*, and tone is shading. The
darkest area of Emblem VIII is the interior of the vault — the part furthest away.
The darkest part of a drawn sphere is its shadowed side, not a groove. Treating ink as
depth produces a relief of the *plate*, not of the *thing depicted*, which is why 213
of these models look like stamped metal rather than like anything in the picture.

### What the marks actually encode, and how to invert it

Engravers' hatching carries two independent channels, and both are recoverable:

- **Stroke direction ≈ surface orientation.** Merian's burin follows the form. This is
  the well-established basis of hatching in graphics — direction fields for hatching are
  built from principal curvature directions, and perceptual work finds people read
  hatching strokes *as* curvature directions
  ([Real-Time Hatching, Praun et al.](https://hhoppe.com/hatching.pdf)).
  The inverse problem is live research: networks that turn line drawings into normal
  maps ([Sketch2Normal](https://hongbofu.people.ust.hk/doc/sketch2normal_i3D2018.pdf),
  [Deep Normal Estimation for Hand-Drawn Characters](https://openaccess.thecvf.com/content_ECCVW_2018/papers/11131/Hudon_Deep_Normal_Estimation_for_Automatic_Shading_of_Hand-Drawn_Characters_ECCVW_2018_paper.pdf)).
- **Stroke density = tone**, which is shape-from-shading input, not height.

**[proposed] The hatching relief pipeline:**

1. Structure tensor over the cutout → dense orientation field θ(x,y) and coherence.
2. Where coherence is high, θ is a projected principal-curvature direction. Where it is
   low (cross-hatching, stipple), fall back to tone only.
3. Estimate tone by local stroke density (morphological line-area fraction, not raw
   luminance — this decouples "dark because dense hatching" from "dark because a thick
   contour").
4. Combine into a normal field: orientation constrains the normal's azimuth, tone
   constrains its elevation under an assumed light.
5. Integrate normals to height (Frankot–Chellappa or a Poisson solve) → relief.

The result is a relief of the depicted *form*. A figure comes out rounded; a wall comes
out flat with its mouldings proud. The current method gives both of them the same
corrugated-ink surface.

Two cheap sanity gates: (a) a drawn sphere must integrate to a convex cap, not a
doughnut; (b) the relief re-rendered with a hatching shader must reproduce the original
stroke direction field — a reprojection gate for shape, exactly parallel to Phase 5's
gate for space.

---

## 3. Make built geometry stop looking like plastic

Phase 5's Emblem VIII vault is a tinted box with a deterministic depth ramp. It reads
as a recess, which was the goal, but it does not read as *engraved*, so the one built
object in the scene is the one object that looks wrong next to Merian.

**[proposed]** Render built architecture with a **tonal art map** hatching shader:
Praun/Hoppe/Webb/Finkelstein's [Real-Time Hatching](https://hhoppe.com/hatching.pdf)
— a mip-chain of hatch images indexed by tone, blended per-fragment, which gives
spatial and temporal coherence for free. A working three.js/GLSL implementation to
start from already exists at
[clicktorelease's cross-hatching shader](https://www.clicktorelease.com/code/cross-hatching/).

The corpus-specific twist that makes this more than a style filter: **build the tonal
art map out of Merian's own strokes.** Sample real hatch patches from the plates at
several densities, tile them into the TAM, and the vault is then shaded with the same
burin marks as the cutouts standing in front of it. Built and drawn geometry become
visually the same material. That is the thing three synthetic-prop attempts could never
achieve, and it is achievable here because we now have 51 plates of stroke data.

Relevant skill: `threejs-procedural-materials` (authored PBR identities, derivative
normals, custom direct-light shadow modulation).

---

## 4. The gate is a test. Make it a loss.

Phase 5's reprojection gate is a binary human judgement: flat grey or not. But
"reconstruction reprojects onto the plate" is a differentiable objective, and every
quantity we currently set by hand — horizon, focal length, eye height, per-element depth
— is a parameter of it.

**[proposed]** Port the assembly to a differentiable renderer (nvdiffrast, PyTorch3D or
Mitsuba 3), initialise from the current solve, and minimise photometric loss against the
plate, with the element foot-line positions as anchors and a regulariser that keeps
depths on the ground plane. The gate stops being a checkbox and becomes the thing that
*produces* the numbers.

Two guardrails, learned from Phase 5:

- **Optimise only what the plate constrains.** Emblem VIII's tunnel length is at the
  vanishing point, i.e. at infinity; no loss will recover it, and an optimiser will
  happily invent a confident wrong value. Parameters must be declared measurable or
  conjectured *before* the fit, exactly as the current override files do.
- **A perfect fit is not a correct model.** The egg reprojects perfectly and its depth
  is still wrong, because it rests on a bench and we assume ground contact. Add a
  *support* relation to the data model (`supported_by: bench`) so an element's depth can
  be inherited from the surface it stands on, and let the optimiser respect it.

---

## 5. Five methods from the literature this corpus fits unusually well

### 5.1 Recurrence-based vanishing points — the best fit of all

[R-VPD (Recurrence-Based Vanishing Point Detection)](https://arxiv.org/html/2412.20666)
finds vanishing points from *repeated structures* rather than from explicit line
segments: cluster SIFT correspondences among recurring patterns, fit virtual lines
through matched features across instances, then weighted RANSAC. Its whole reason for
existing is images where straight-line detection fails.

This corpus is made of repeated structures — crenellations, floor tiles, brick courses,
window bays, balusters — and repetition survives hatching far better than any single
edge does. Better still, **equally-spaced repetition gives metric scale as well as
direction**: three or more equally spaced coplanar parallel lines have a characteristic
cross-ratio that determines the line at infinity in closed form
([Liebowitz & Zisserman, metric rectification](https://www.cs.ucf.edu/courses/cap6938-02/refs/liebowitz98metric.pdf)).
The crenellations along Emblem VIII's wall could pin down the focal length that two
separate attempts failed to measure — replacing the current `ASSUMED` with a real
number.

### 5.2 DeepLSD instead of Canny + Hough

[DeepLSD](https://github.com/cvg/DeepLSD) (CVPR 2023) regresses a line attraction field
with a network and refines with a handcrafted detector, explicitly to survive noisy
gradients and texture where LSD degrades. Combined with the ¼-scale finding above, this
is the obvious upgrade to `solve_perspective.py`'s front end. Worth benchmarking
against the three hand-measured plates before adopting — the same table as §1, so the
comparison is already set up.

### 5.3 GeoCalib as an independent witness

[GeoCalib](https://github.com/cvg/GeoCalib) (ECCV 2024) predicts a dense perspective
field — a per-pixel up-vector and latitude — and recovers intrinsics and gravity from a
single image, combining a network with a geometric optimiser. It was trained on
photographs, so on 1617 engravings expect a domain gap; but its *latitude* channel is
literally "how far is this pixel from the horizon," and its confidence maps are highest
near the horizon and near vertical structures. Even a degraded prediction is a useful
independent vote, and disagreement between GeoCalib and the line solver is itself a
signal that a plate needs human review. Use it to triage 51 plates, not to decide them.

### 5.4 Depth Anything 3 as a *relative* prior, anchored by our metric

[Depth Anything 3](https://github.com/ByteDance-Seed/Depth-Anything-3) (Nov 2025)
predicts spatially consistent geometry from arbitrary views with a plain transformer and
a unified depth-ray representation, and substantially outperforms DA2 on monocular depth.

Do **not** use it as an oracle — it will hallucinate confident depth for a 400-year-old
engraving and there is no way to audit it. Use it as the dense half of a hybrid:

```
DA3            → dense relative depth, unknown scale and offset, unauditable
perspective    → sparse metric depth at every ground contact, fully audited
   fit         → least-squares the affine (scale, shift) that maps DA3 onto our anchors
   result      → dense metric depth, with residuals at the anchors as the quality report
```

The residual at each anchor is the audit. If DA3 can be affinely mapped onto our
measured contacts with small residual, its dense field is trustworthy for the parts we
did not measure. If it cannot, we learn that and say so. This turns an unverifiable
model into a verifiable one, and it is what makes dense depth admissible in a project
with these scholarly commitments.

### 5.5 Tour Into the Picture, properly

[Horry, Anjyo & Arai's *Tour Into the Picture*](https://dl.acm.org/doi/10.1145/258734.258854)
(SIGGRAPH '97) is the canonical method for exactly what this project does: a "spidery
mesh" giving a background of at most five rectangles — floor, ceiling, two side walls,
back wall — with hierarchical polygons as billboards for foreground objects, all from one
vanishing point.

Phase 5's `plateBand()` is a partial rediscovery of the background half. Adopting TIP
fully means the *inside* of the picture becomes a room rather than a stack of planes:
walking sideways in Emblem VIII would reveal courtyard side walls instead of the edges
of cards. [Kang's extension using a vanishing *line*](https://www.umsl.edu/~kangh/Papers/kang_cgf01.pdf)
handles the oblique and landscape cases TIP's single-VP formulation cannot, which maps
directly onto the router in §1.

And it has a direct art-historical precedent to cite: Criminisi, Kemp and Zisserman's
[*Bringing Pictorial Space to Life*](https://www.microsoft.com/en-us/research/publication/bringing-pictorial-space-to-life-computer-techniques-for-the-analysis-of-paintings-2/)
applied single-view reconstruction to Renaissance paintings, and — importantly for us —
insisted that *a painting's internal geometric consistency must be assessed before any
geometric analysis is carried out*, because a perspectival picture is an artificial
construction subject to imaginative manipulation and inadvertent inaccuracy. That is
the scholarly framing for the router in §1 and for Emblem I's preserved 1.8×-scale
Boreas: **inconsistency is a finding about the artist, not an error to be optimised
away.**

---

## 6. Occlusion, and the one thing the tunnel book still cannot do

Every card is a flat billboard. Walk to the side and figures thin to a line. That is
honest for a papercraft conceit, but it means the reconstruction can never show what is
*behind* anything — and the backdrop behind a popped figure is the original plate, in
which that figure is still drawn.

**[proposed]** Two layers of fix, in order of cost:

1. **Amodal completion of the backdrop.** Where an element is lifted forward, inpaint
   the hole it leaves in the rear plane. This is the standard 3D-photo problem, solved by
   [3D Photography using Context-aware Layered Depth Inpainting](https://github.com/vt-vl-lab/3d-photo-inpainting)
   (CVPR 2020) and [AdaMPI](https://github.com/yxuhan/AdaMPI) (SIGGRAPH 2022). For a
   generative approach to whole-object completion,
   [pix2gestalt](https://gestalt.cs.columbia.edu/static/pix2gestalt.pdf) and
   [Open-World Amodal Appearance Completion](https://github.com/saraao/amodal) (CVPR 2025)
   synthesise the occluded parts as RGBA elements.
   **Corpus-specific shortcut that beats all of them:** we hold *two witnesses of the
   same engraving* — the b/w Claudiens scan and the hand-coloured page scan. Register one
   to the other and the occluded pixels are not hallucinated, they are **cited**. Detail
   in `../EmblemPrintShop/PROPOSAL_EXTRACTION_V2.md` §4.
2. **Give figures thickness.** Not full 3D — a shallow relief shell driven by §2's
   hatching normals, so a figure has a rounded front surface and a silhouette that holds
   up to ±30°. This is the papercraft idea done right: a cut-out that is embossed, which
   is what a good shadow-box figure actually is.

---

## 7. Order of work

| # | Work | Cost | Why now |
|---|---|---|---|
| 1 | Multi-scale line detection (¼ scale) in `solve_perspective.py` | hours | **[measured]** 0.181 → 0.014 on Emblem VIII, one resize |
| 2 | Armature router; let a class return "no horizon recoverable" | 1 day | stops two thirds of the corpus being confidently wrong |
| 3 | `supported_by` relation in the element schema | hours | fixes the egg; the gate cannot catch this class of error |
| 4 | Recurrence-based VP on the repeated architecture | 2–3 days | could measure the focal length we currently assume |
| 5 | Hatching relief (§2) replacing luminance displacement | 3–4 days | 213 gallery models are currently semantically inverted |
| 6 | TAM hatching shader for built geometry | 2 days | the one built object stops looking like plastic |
| 7 | Equal-height horizon from figures | 1 day | **blocked** on figure recall — PrintShop §1 |
| 8 | DA3 anchored by our metric; LDI layering | 3 days | dense depth that is auditable |
| 9 | Full TIP spidery mesh; gate as a differentiable loss | 1 week | the reconstruction becomes a room |

Items 1–3 are cheap and each fixes something already known to be wrong. Item 7 is the
one that unlocks the rest of the corpus, and it is not in this repository.

---

## Sources

- [Criminisi, Reid & Zisserman, *Single View Metrology*, IJCV 2000](https://www.robots.ox.ac.uk/~lav/Papers/criminisi_etal_ijcv2000/criminisi_etal_ijcv2000.html)
- [Criminisi, Kemp & Zisserman, *Bringing Pictorial Space to Life*](https://www.microsoft.com/en-us/research/publication/bringing-pictorial-space-to-life-computer-techniques-for-the-analysis-of-paintings-2/)
- [Horry, Anjyo & Arai, *Tour Into the Picture*, SIGGRAPH '97](https://dl.acm.org/doi/10.1145/258734.258854) · [Kang's vanishing-line extension](https://www.umsl.edu/~kangh/Papers/kang_cgf01.pdf)
- [Liebowitz & Zisserman, *Metric Rectification for Perspective Images of Planes*](https://www.cs.ucf.edu/courses/cap6938-02/refs/liebowitz98metric.pdf)
- [Recurrence-Based Vanishing Point Detection](https://arxiv.org/html/2412.20666)
- [DeepLSD (cvg)](https://github.com/cvg/DeepLSD) · [ScaleLSD](https://arxiv.org/html/2506.09369v1) · [Line Segment Detection Papers](https://github.com/lh9171338/Line-Segment-Detection-Papers)
- [GeoCalib (cvg)](https://github.com/cvg/GeoCalib) · [AnyCalib](https://arxiv.org/pdf/2503.12701)
- [Depth Anything 3 (ByteDance-Seed)](https://github.com/ByteDance-Seed/Depth-Anything-3) · [MoGe-2](https://arxiv.org/pdf/2507.02546)
- [Praun, Hoppe, Webb & Finkelstein, *Real-Time Hatching*](https://hhoppe.com/hatching.pdf) · [three.js cross-hatching shader](https://www.clicktorelease.com/code/cross-hatching/)
- [Sketch2Normal](https://hongbofu.people.ust.hk/doc/sketch2normal_i3D2018.pdf) · [Deep Normal Estimation for Hand-Drawn Characters](https://openaccess.thecvf.com/content_ECCVW_2018/papers/11131/Hudon_Deep_Normal_Estimation_for_Automatic_Shading_of_Hand-Drawn_Characters_ECCVW_2018_paper.pdf)
- [3D Photo Inpainting](https://github.com/vt-vl-lab/3d-photo-inpainting) · [AdaMPI](https://github.com/yxuhan/AdaMPI) · [pix2gestalt](https://gestalt.cs.columbia.edu/static/pix2gestalt.pdf)

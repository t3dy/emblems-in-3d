# AI fill — completing what the engraver never drew

Status: **research + a queue, no generation implemented.** The review app can now
flag an element "fill in with AI later" (`needs_ai_fill` in
`data/elements.overrides.json`); nothing consumes that flag yet. This document is
the design that any implementation has to satisfy, written before the pixels exist
so the rules are not retrofitted around whatever a model happens to produce.

## The problem, stated exactly

Cut a townscape out of a plate where two figures stand in front of it and you get a
building with two person-shaped holes. That is correct extraction — the engraver
never drew the wall behind the figures, so there is nothing there to lift. The hole
is **an absence of evidence**, and it becomes a problem only when the asset is
reused somewhere the figures are not: the building placed alone in a 3D world, or
composed into a different scene, carries two silhouettes of people who are no
longer present.

So the fill is a real need. It is also the single most dangerous thing this pipeline
could do, because a good inpainter produces something that looks exactly like the
source and is not.

## The hard rule

**A fill is never painted into the extracted asset.** It is a separate layer with
its own file, its own provenance record, and its own visible status. The extracted
PNG on disk keeps its holes forever.

This follows the distinction the ecosystem already enforces (see
`3dprintlab/docs/EXTRACTION.md`): EXTRACTED (pixels lifted from the source),
RECONSTRUCTED (modelled from evidence), GENERATED (invented). Those three must never
share a field, a file, or a colour. A fill is the third kind. Concretely:

```
cutouts/townscape.png            extracted   — keeps its holes
fills/townscape.fill.png         generated   — the invented pixels alone, alpha-masked to the hole
fills/townscape.fill.json        provenance  — model, prompt, seed, date, who accepted it
```

Compositing them is a *display* decision, always reversible, and any view that shows
a filled asset must be able to show the hole again. A viewer that cannot toggle the
fill off is a bug.

## Why the usual tools are the wrong shape

Most inpainting is built to make plausible photographs. Two mismatches matter here:

1. **Domain.** These are 16th–17th c. engravings: the "texture" is directional
   burin hatching whose density encodes tone and whose direction encodes form.
   General diffusion inpainters trained on photographs reproduce smooth gradients
   and invent hatching that does not follow any plausible engraver's hand. On the
   hand-coloured plates the problem doubles — the colour is a later wash over the
   line, so a fill must be right in two layers at once.
2. **Confidence.** An inpainter always returns something, with no signal for "I do
   not know". Behind a large foreground figure there may be genuinely no
   recoverable structure. A system that cannot decline will confidently invent a
   doorway that never existed, and it will look period-correct.

## Options, in the order they should be tried

Cheapest and most defensible first. Nothing here is a recommendation to build yet.

**1 — Symmetry and repetition transfer (not AI at all).**
Architecture in these plates is highly regular: courses of brick, ranks of windows,
roof tiles, repeated bays. A hole in a facade can very often be filled by copying a
*different part of the same building in the same plate*, corrected for the local
perspective the project already solves (`data/perspective.json` has a horizon and
focal length per plate). This is the strongest option available and it is not
generative: every filled pixel is still engraved pixel from the same source, merely
relocated, which makes it auditable in a way a diffusion sample never is. It should
be attempted before any model is downloaded. Where it works it is the right answer;
where the hole covers something non-repeating it fails honestly and loudly.

**2 — Classical exemplar-based inpainting (PatchMatch / Criminisi).**
Same principle, less supervision: fill by searching the rest of the plate for
matching patches, prioritising strong linear structure. Works well on hatching
precisely because hatching is self-similar. Deterministic, offline, no model
weights, and each filled patch can record where it came from. `cv2.inpaint` (Telea /
Navier–Stokes) is available already but is built for scratches and will smear over
holes of this size — it is a baseline to beat, not a solution.

**3 — A diffusion inpainter, conditioned hard.**
Only if 1 and 2 leave holes that matter. If it is used:
- keep it **local and offline** (Stable Diffusion inpainting weights run on this
  machine; the segmentation stack here is already torch + transformers);
- condition on structure, not just a text prompt — a ControlNet-style line/edge
  conditioning fed from the plate's own linework, which is exactly the kind of
  edge map the WO-012 prototype in EmblemPrintShop already produces with Canny;
- generate several samples with recorded seeds and require a human to pick one,
  because a single sample presented alone reads as truth;
- never prompt with the *emblem's meaning*. Prompting "an alchemical furnace"
  invites the model to draw iconography the source does not contain. Prompt for
  material and technique ("brick wall, engraved hatching") and let the structure
  conditioning carry the rest.

**What to refuse outright:** any fill of a region where the hole spans something
whose form is not evidenced elsewhere in the plate — a face, a whole object, the
only instance of a piece of apparatus. That is not completion, it is invention of
subject matter, and the correct output is a fill marked `declined: no evidence`.

## What the flag carries today

Set by the checkbox in `review/index.html`, written by `POST /api/ai-fill` into
`data/elements.overrides.json`:

```json
"townscape.png": {
  "needs_ai_fill": true,
  "ai_fill_status": "queued",
  "ai_fill_note": "two figures removed from the facade",
  "ai_fill_flagged_at": "2026-08-31T…Z"
}
```

`ai_fill_status` is deliberately a string, not a boolean, so an implementation can
move a card through `queued → filled → declined` without a second field. The
extractor pre-populates the checkbox: `segment_plate.py` records `occluded_by` and
`occluded_frac` on every card it cuts a hole in, so the review app can tick the box
for exactly the cards that have holes rather than asking a human to find them.

## First thing to build, when this is picked up

Not a model. A **hole report**: for every extracted card, the area of its holes, what
occluded it, and whether the missing region is covered by repeating structure
elsewhere in the same plate (option 1's feasibility test). That report will show how
many holes actually matter — plausibly very few, since most occluded cards are
backgrounds that are never reused alone. Building a diffusion pipeline before that
number is known would be solving a problem nobody has measured.

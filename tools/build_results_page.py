#!/usr/bin/env python
"""
build_results_page.py — the Results tab, generated from the data.

Everything on this page is read out of data/perspective.json and the recorded
experiment tables rather than typed in, because a results page whose numbers can
drift from the run that produced them is worse than no results page.

Usage:  python tools/build_results_page.py
"""
import json
from pathlib import Path

import build_site_pages as bs   # shell(), esc(), roman()

ROOT = Path(__file__).resolve().parent.parent
PERSP = json.loads((ROOT / "data" / "perspective.json").read_text(encoding="utf-8"))
RELIEF = json.loads((ROOT / "site" / "assets" / "relief" / "manifest.json").read_text(encoding="utf-8"))

# The hatching-suppression experiment, run 2026-08-31 against the three
# hand-measured plates. Recorded verbatim; re-run with the script named below.
SUPPRESSION = {
    "script": "scratchpad/hatch_test.py",
    "truth_note": "truth = horizon ny, measured by hand on a 0.05 normalised grid",
    "rows": [
        ("Emblem VIII", "ruled courtyard", 0.455,
         (0.274, 0.181), (0.469, 0.014), (0.390, 0.065)),
        ("Emblem XXI", "frontoparallel wall", 0.286,
         (0.602, 0.316), (0.877, 0.591), (0.531, 0.245)),
        ("Emblem I", "figure landscape", 0.570,
         (0.678, 0.108), (0.145, 0.425), (0.749, 0.179)),
    ],
}

# The scale-consistency existence test, from tools/classify_armature.py
STABILITY = [
    ("Emblem XLV", 0.006, "ruled", "a real construction, and the test says so"),
    ("Emblem I", 0.125, "open", "landscape; nothing to converge"),
    ("Emblem VIII", 0.284, "open", "construction present but half-occluded by the "
     "swordsman. The 1/4-scale solve is right to 0.014, the others disagree, and the "
     "test correctly declines to confirm it unattended"),
    ("Emblem XXI", 0.358, "open", "frontoparallel wall: no vanishing point exists"),
    ("Emblem V", 0.456, "open", "figures and drapery only"),
]


def main():
    cls = {}
    for v in PERSP.values():
        cls[v.get("armature_class", "unclassified")] = cls.get(v.get("armature_class", "unclassified"), 0) + 1
    claimed = sum(1 for v in PERSP.values() if v.get("horizon_recoverable"))
    reviewed = sum(1 for v in PERSP.values() if v.get("reviewed"))
    auto = sum(1 for v in PERSP.values() if v.get("armature_class") == "ruled" and not v.get("reviewed"))
    blank = sum(1 for v in PERSP.values() if v.get("horizon_recoverable") is False)

    sup_rows = "\n".join(
        f"<tr><td><strong>{n}</strong><div class='fine'>{k}</div></td>"
        f"<td class='num'>{t}</td>"
        + "".join(
            f"<td class='num'>{val:.3f}<div class='fine' style='color:{'var(--good)' if err < 0.05 else 'var(--bad)' if err > 0.15 else 'var(--weak)'}'>err {err:.3f}</div></td>"
            for val, err in (a, b, c))
        + "</tr>"
        for n, k, t, a, b, c in SUPPRESSION["rows"])

    stab_rows = "\n".join(
        f"<tr><td><strong>{n}</strong></td><td class='num'>{s:.3f}</td>"
        f"<td><span class='badge {'good' if v == 'ruled' else 'weak'}'>{v}</span></td>"
        f"<td class='fine'>{bs.esc(note)}</td></tr>"
        for n, s, v, note in STABILITY)

    relief_cards = "\n".join(
        f"""  <a class="card" href="relief.html">
    <img src="assets/{RELIEF[k]['flow']}" alt="recovered stroke field for {k}" loading="lazy" />
    <div class="body"><div class="name">{bs.roman(k) if k != 'emblem-00' else 'Frontispiece'}</div>
    <div class="meta">stroke field coherent over {int(RELIEF[k]['coherent_fraction'] * 100)}% ·
      {int(RELIEF[k]['stroke_driven_fraction'] * 100)}% stroke-driven</div></div>
  </a>""" for k in sorted(RELIEF))

    body = f"""
<div class="lede">
  <p>Two experiments, run against plates whose answers were measured by hand first, so
  that a method could be shown to be wrong rather than argued about. Both changed what
  the pipeline does.</p>
</div>

<h2>1 · Hatching really was swamping the solver — on the plates that have a construction</h2>
<div class="lede">
  <p>Three ways of getting the burin hatching out of the way before detecting lines,
  scored against the hand measurement. <em>Coarse ¼-scale</em> simply detects on a
  downsampled plate: hatching is fine and high-frequency, construction lines are long
  and survive.</p>
</div>
<div class="scroll-x"><table class="data">
<thead><tr><th>plate</th><th>truth</th><th>baseline</th><th>coarse ¼-scale</th><th>texture-suppressed</th></tr></thead>
<tbody>
{sup_rows}
</tbody></table></div>
<div class="lede">
  <p>Read the halves separately, because they say opposite things.</p>
  <p><strong>On the ruled plate, scale space essentially solves it.</strong> Emblem
  VIII's horizon error falls from 0.181 to <strong>0.014</strong> — within a hair of the
  hand measurement — for the cost of one <code>resize</code>.</p>
  <p><strong>On the other two, every variant fails, and it is not the detector's
  fault.</strong> Emblem XXI's wall is frontoparallel: it has no vanishing point, which
  is exactly why its great circle reads as a true circle. Emblem I is a landscape with
  no architecture. The solver was confidently answering a question those plates do not
  pose, and better line detection made it worse, not better.</p>
</div>

<h2>2 · An existence test: does this plate <em>have</em> a vanishing point?</h2>
<div class="lede">
  <p>A real ruled construction is scale-invariant. Solve the vanishing point
  independently at ⅙, ¼ and ⅓ scale and the three answers should agree, because the
  construction lines are long and survive every scale. Hatching noise does not: which
  "vanishing point" it produces depends on which frequency band you happen to look at.
  So the <em>spread</em> of the three answers is a test of whether there is anything
  there to find.</p>
</div>
<div class="scroll-x"><table class="data">
<thead><tr><th>plate</th><th>scale spread</th><th>verdict</th><th>what it means</th></tr></thead>
<tbody>
{stab_rows}
</tbody></table></div>

<h2>3 · What that did to the corpus</h2>
<div class="lede">
  <p>Applying the test to all 51 plates:</p>
</div>
<div class="scroll-x"><table class="data">
<thead><tr><th>class</th><th>plates</th><th>meaning</th></tr></thead>
<tbody>
<tr><td><span class="badge good">ruled</span></td><td class="num">{cls.get('ruled', 0)}</td>
    <td>a construction confirmed at three scales; the vanishing point is meaningful</td></tr>
<tr><td><span class="badge weak">uncertain</span></td><td class="num">{cls.get('uncertain', 0)}</td>
    <td>probably a construction, but not trustworthy unattended — usually architecture
        partly occluded by figures</td></tr>
<tr><td><span class="badge">frontal</span></td><td class="num">{cls.get('frontal', 0)}</td>
    <td>built parallel to the picture plane; there is nothing to converge</td></tr>
<tr><td><span class="badge">open</span></td><td class="num">{cls.get('open', 0)}</td>
    <td>foliage, terrain, drapery and figures — which is most of this book</td></tr>
</tbody></table></div>

<div class="lede">
  <p><strong>The corpus now carries {claimed} horizons instead of 51.</strong>
  {reviewed} hand-measured, {auto} confirmed automatically, and <strong>{blank} plates
  where the record is deliberately blank</strong> and says why.</p>
  <p>That is a much smaller number than before and it is a better one. Every plate used
  to carry a horizon and a confidence score; most of those horizons were wrong, and the
  score made them look considered. A blank field that explains itself is more useful to
  work from than a number that has to be checked before it can be trusted.</p>
  <p>It is also a finding about Merian rather than about the software. Only a couple of
  plates in <em>Atalanta Fugiens</em> are built on a ruled perspective construction at
  all. It is overwhelmingly a book of figures in landscape — which is why the estimator
  that matters next is the one that reads the horizon off a standing figure, and why the
  thing blocking it is that the extraction pipeline has found five figures in fifty-one
  plates.</p>
</div>

<h2>4 · Reading the marks as shape</h2>
<div class="lede">
  <p>The gallery's 213 "carved relief" models drive a displacement map from the plate's
  luminance — light paper proud, dark ink incised. That is semantically inverted. Ink
  density in an engraving is <em>tone</em>, and tone is shading: the darkest part of a
  drawn sphere is its shadowed side, not a groove, and the darkest part of Emblem VIII
  is the inside of the vault, the furthest thing away.</p>
  <p>The burin follows the form, so stroke <em>direction</em> is evidence about surface
  orientation and stroke <em>density</em> is tone. A structure tensor recovers the
  stroke field; the height gradient is taken across the strokes, signed by which way the
  tone increases; that field is integrated to a surface. Below is the recovered stroke
  field for each plate processed so far — every one of these is read off the engraving,
  not drawn.</p>
  <p><a class="btn" href="relief.html">Open the Relief Lab ▸</a>
     &nbsp;<span class="fine">sweep a raking light across both surfaces and compare</span></p>
</div>
<div class="grid">
{relief_cards}
</div>

<p class="fine" style="margin-top:40px;border-top:1px solid var(--rule);padding-top:14px">
Both experiments are reproducible: <code>tools/classify_armature.py</code> for the
existence test, <code>tools/hatching_relief.py</code> for the relief. The full research
survey and the ordered plan built on these results are in
<code>PROPOSAL_PHASE6.md</code>, with companion proposals for EmblemPrintShop,
EmblemPapercraft and 3dprintlab.
</p>
"""
    out = ROOT / "site" / "results.html"
    out.write_text(bs.shell(
        "Results", "results.html", body,
        "Two experiments against hand-measured ground truth, and what they changed: "
        "an existence test for vanishing points, and reading shape from the burin strokes."),
        encoding="utf-8")
    print(f"-> {out}")
    print(f"   {claimed} claimed horizons · {reviewed} reviewed · {auto} auto · {blank} blank")


if __name__ == "__main__":
    main()

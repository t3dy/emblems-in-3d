#!/usr/bin/env python
"""
build_site_pages.py — generate the data-driven pages of the Phase 5 site.

Writes site/plates.html (all 51 solves, honest about which are weak) and
site/examples.html (the three worked examples with their measurements). These are
generated rather than hand-written so the numbers on the page can never drift
from data/perspective.json — the failure mode this whole phase exists to fix.

Usage:  python tools/build_site_pages.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
PERSP = json.loads((ROOT / "data" / "perspective.json").read_text(encoding="utf-8"))
ELEMS = json.loads((ROOT / "data" / "elements.json").read_text(encoding="utf-8"))

ROMAN = ["Frontispiece"] + [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
    "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX",
    "XXXI", "XXXII", "XXXIII", "XXXIV", "XXXV", "XXXVI", "XXXVII", "XXXVIII", "XXXIX", "XL",
    "XLI", "XLII", "XLIII", "XLIV", "XLV", "XLVI", "XLVII", "XLVIII", "XLIX", "L"]

WORKED = {
    "emblem-08": ("The courtyard", "one-point"),
    "emblem-01": ("Boreas", "figure landscape"),
    "emblem-21": ("The squared circle", "frontal wall"),
}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def shell(title, current, body, desc=""):
    tabs = [("index.html", "Overview"), ("examples.html", "The three examples"),
            ("plates.html", "All 51 plates"), ("results.html", "Results"),
            ("relief.html", "Relief Lab"), ("method.html", "Method"),
            ("findings.html", "What was wrong")]
    nav = "\n".join(
        f'  <a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a>'
        for h, t in tabs)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(title)} · Emblems in 3D</title>
<meta name="description" content="{esc(desc)}" />
<link rel="stylesheet" href="css/site.css" />
</head>
<body>
<div class="wrap">
<header class="masthead">
  <h1>{esc(title)}</h1>
  <p class="sub">{esc(desc)}</p>
</header>
<nav class="tabs">
{nav}
</nav>
{body}
</div>
</body>
</html>
"""


def roman(key):
    n = int(key.split("-")[1])
    return ROMAN[n] if n < len(ROMAN) else str(n)


# ---------------------------------------------------------------- plates ----
def plates_page():
    rows, cards = [], []
    n_rev = n_weak = 0
    for key in sorted(PERSP):
        p = PERSP[key]
        els = ELEMS.get(key, {}).get("elements", [])
        conf = p.get("confidence", 0) or 0
        reviewed = bool(p.get("reviewed"))
        if reviewed:
            n_rev += 1
            badge, cls = "hand-reviewed", "good"
        elif conf >= 0.25:
            badge, cls = f"auto · {conf:.2f}", ""
        else:
            n_weak += 1
            badge, cls = f"weak · {conf:.2f}", "weak"

        standing = sum(1 for e in els if e["kind"] == "standing")
        assumed = str(p.get("focal_basis", "")).startswith("ASSUMED")
        cards.append(f"""  <a class="card" href="reconstruct.html?id={key}">
    <img src="assets/solve/{key}.jpg" alt="perspective solve for {key}" loading="lazy" />
    <div class="body">
      <div class="name">Emblem {roman(key)} <span class="badge {cls}">{badge}</span></div>
      <div class="meta">{esc(p.get('type'))} · horizon ny {p.get('horizon_ny')} ·
        {len(els)} elements, {standing} standing</div>
    </div>
  </a>""")
        rows.append(
            f"<tr><td><a href='reconstruct.html?id={key}'>Emblem {roman(key)}</a></td>"
            f"<td>{esc(p.get('type'))}</td>"
            f"<td class='num'>{p.get('horizon_ny')}</td>"
            f"<td class='num'>{p.get('focal_px')}{' <span class=\"fine\">assumed</span>' if assumed else ''}</td>"
            f"<td class='num'>{p.get('eye_height_m')} m</td>"
            f"<td class='num'>{conf:.2f}</td>"
            f"<td class='num'>{len(els)}</td>"
            f"<td><span class='badge {cls}'>{badge}</span></td></tr>")

    body = f"""
<div class="lede">
  <p>Every plate's recovered perspective, drawn back onto the engraving that produced
  it. Yellow is the horizon and the vanishing point; green ticks are the ground-contact
  points that every depth is computed from, pale ticks where that contact is
  low-confidence. On automatic solves the cyan and orange segments are the lines that
  voted for the vanishing point — which is the fastest way to see <em>why</em> a solve
  is wrong, not just that it is.</p>
  <p><strong>{n_rev} hand-reviewed · {51 - n_rev - n_weak} usable automatic ·
  {n_weak} weak.</strong> The weak ones are the honest majority. Dense engraved
  hatching is thousands of short parallel lines and it swamps a Hough-and-RANSAC
  vanishing-point search; the automatic pass is a first draft that a person has to
  correct, which is what the local review app is for.</p>
</div>

<h2>The solves</h2>
<div class="grid">
{chr(10).join(cards)}
</div>

<h2>The numbers</h2>
<div class="scroll-x"><table class="data">
<thead><tr><th>plate</th><th>armature</th><th>horizon ny</th><th>focal px</th>
<th>station eye</th><th>conf</th><th>elements</th><th>status</th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody></table></div>
"""
    return shell("All 51 plates", "plates.html", body,
                 "Every plate's recovered perspective drawn back onto the engraving, "
                 "with the numbers each reconstruction is built from.")


# -------------------------------------------------------------- examples ----
def examples_page():
    secs = []
    for key, (name, kind) in WORKED.items():
        p = PERSP[key]
        els = ELEMS.get(key, {}).get("elements", [])
        bits = []
        for f in ("horizon_basis", "focal_basis", "eye_height_basis",
                  "derived_check", "metric_anomaly", "ornament_basis", "notes"):
            if p.get(f):
                bits.append(f"<h3>{f.replace('_', ' ')}</h3><p>{esc(p[f])}</p>")
        kinds = {}
        for e in els:
            kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
        secs.append(f"""
<h2 id="{key}">Emblem {roman(key)} — {esc(name)}</h2>
<p class="fine">{esc(kind)} · horizon ny {p['horizon_ny']} · f {p['focal_px']} px ·
   station eye {p['eye_height_m']} m · confidence {p['confidence']} ·
   elements {', '.join(f'{v} {k}' for k, v in sorted(kinds.items())) or 'none'}</p>
<div class="two-up">
  <div class="rev-figure"><img src="assets/plates/{key}.jpg" alt="Emblem {roman(key)}" loading="lazy" /></div>
  <div class="rev-figure"><img src="assets/solve/{key}.jpg" alt="solve for Emblem {roman(key)}" loading="lazy" /></div>
</div>
<p style="margin:12px 0"><a class="btn" href="reconstruct.html?id={key}">Open the reconstruction ▸</a></p>
<div class="lede">{''.join(bits)}</div>
""")
    body = f"""
<div class="lede">
  <p>Three plates measured by hand on a normalised grid, chosen because between them
  they cover the three things a reconstruction has to get right: a ruled interior, a
  landscape of receding registers, and a surface that carries a picture.</p>
</div>
{''.join(secs)}
"""
    return shell("The three examples", "examples.html", body,
                 "Emblem VIII, Emblem I and Emblem XXI, measured by hand and rebuilt "
                 "from their own perspective constructions.")


if __name__ == "__main__":
    (SITE / "plates.html").write_text(plates_page(), encoding="utf-8")
    (SITE / "examples.html").write_text(examples_page(), encoding="utf-8")
    print(f"-> {SITE / 'plates.html'}\n-> {SITE / 'examples.html'}")

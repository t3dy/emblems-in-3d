#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_world.py - compile site/data/world.json, the single content file behind
the walkable world (site/world.html).

Nothing in the renderer is authored by hand. This joins, per emblem:

  Claudiens DB (C:/Dev/Claudiens/db/atalanta.db)
      motto LA/EN, epigram EN, discourse summary, alchemical stage + palette,
      scholarly_refs (de Jong 1969 and others, with page where recorded),
      source_authorities (the alchemical / classical / biblical texts the
      discourse cites) -> the "what story is being drawn upon" panel
  data/perspective.json      the armature class and the solve, or an honest
                             "no horizon recoverable"
  data/elements.json         cutouts with measured ground contacts
  site/assets/manifest.json  the web plate and its warped ground, where one exists
  locations.js               the setting archetype read off Maier's own text

and precomputes each station's metric placement in PYTHON, so the numbers are
reviewable in a file rather than buried in a shader.

Two tiers, per DECISIONS.md sec. 2:

  measured     horizon recoverable -> depths from  Z = f*E/(y - horizon)
  conjectural  no horizon          -> a flat cut sheet, cutouts popped forward
                                      in PARALLEL projection so that no
                                      perspective claim is made at all

Usage:  python tools/build_world.py
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = Path(r"C:/Dev/Claudiens/db/atalanta.db")
OUT = ROOT / "site" / "data" / "worlds" / "atalanta.json"

# --- the conjectural constants, named so they can be argued with -------------
FLAT_HEIGHT_M = 4.40   # CONJECTURE: a plate hung as a cut sheet stands this tall
FLAT_DEPTH_M = 7.00    # CONJECTURE: how far into its bay the sheet stands
POP_STEP_M = 0.22      # CONJECTURE: papercraft pop per layer, parallel projection
EYE_DEFAULT_M = 1.62

# A solve is only admitted to the measured tier if the lens it implies is one a
# person could have drawn through. Merian's three hand-measured plates sit at
# 27.8, 43.3 and 43.4 degrees vertical; this band is deliberately generous
# either side of that. Emblem XXIV's automatic two-vanishing-point solve gives
# f = 197 px on a 1408 px plate, i.e. a 149-degree vertical field, which is not
# a perspective construction but a spurious orthogonality fit. Phase 5 rejected
# Emblem VIII's spurious distance-point cluster rather than adopting it; the
# same rule applies here, and the rejection is recorded rather than clamped.
VFOV_MIN_DEG = 15.0
VFOV_MAX_DEG = 70.0

STAGE_ORDER = ["NIGREDO", "ALBEDO", "CITRINITAS", "RUBEDO"]

# --- road layout -------------------------------------------------------------
BAY_SPACING_M = 26.0   # along-road distance between consecutive stations
ROAD_HALF_W_M = 3.2
BAY_OFFSET_M = 15.0    # how far off the road centre a station bay sits
# The course does not run dead straight: it swings, so you can never see more
# than a few stations ahead and the walk has a shape. One sine, no randomness.
SWING_AMP_M = 34.0
SWING_PERIOD = 11.0    # stations per full swing


def load_locations():
    """Parse the LOCATION map straight out of locations.js (it is the source)."""
    src = (ROOT / "locations.js").read_text(encoding="utf-8")
    body = src[src.index("export const LOCATION"):]
    body = body[body.index("{"): body.index("};") + 1]
    pairs = re.findall(r'"(\d+)"\s*:\s*"([a-z]+)"', body)
    return {int(k): v for k, v in pairs}


# George Ripley's twelve gates, the order an early modern reader would have
# recognised as the sequence of the work. emblemdata.js already tags every
# emblem with the operation it stages; ordering those tags by Ripley turns the
# book into a second, non-narrative route through the same world.
RIPLEY = [
    "calcination", "solution", "separation", "conjunction", "putrefaction",
    "congelation", "fixation", "digestion", "fusion", "fermentation",
    "multiplication", "projection",
]

PROCESS_GLOSS = {
    "calcination": "burning to a powder: the first gate, where the body is opened by fire",
    "solution": "reducing the calcined body to water, so that it can be worked",
    "separation": "dividing the subtle from the gross, the pure from the impure",
    "conjunction": "the marriage of the separated principles, male to female",
    "putrefaction": "the blackening death in the sealed vessel, without which nothing generates",
    "congelation": "the fixing of what was volatile into a stable white body",
    "fixation": "making the volatile abide the fire and no longer fly",
    "digestion": "the long gentle heat in which the matter feeds on itself",
    "fusion": "melting into one flowing body",
    "fermentation": "leavening the stone with gold, as bread is leavened",
    "multiplication": "increasing the virtue of the stone in quantity and in strength",
    "projection": "the casting of the finished stone upon the base metal",
}


def load_processes():
    """The operation each emblem stages, read out of emblemdata.js."""
    src = (ROOT / "emblemdata.js").read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'"(\d+)":\s*\{(.*?)\n \}', src, re.S):
        n = int(m.group(1))
        pm = re.search(r'"process":\s*"([a-z]+)"', m.group(2))
        if pm:
            out[n] = pm.group(1)
    return out


def load_settings():
    """Parse the SETTINGS archetypes (ground colour + floor material) too."""
    src = (ROOT / "locations.js").read_text(encoding="utf-8")
    body = src[src.index("export const SETTINGS"):]
    out = {}
    for name, ground, floor in re.findall(
        r'(\w+):\s*\{\s*ground:\s*(0x[0-9a-fA-F]+),\s*floor:\s*"(\w+)"', body
    ):
        out[name] = {"ground": int(ground, 16), "floor": floor}
    return out


def jload(p):
    return json.loads(p.read_text(encoding="utf-8"))


def db_rows():
    con = sqlite3.connect(str(DB))
    con.row_factory = sqlite3.Row
    out = {}
    for r in con.execute("select * from emblems order by number"):
        r = dict(r)
        n = r["number"]
        try:
            palette = json.loads(r["stage_palette"]) if r["stage_palette"] else {}
        except Exception:
            palette = {}
        try:
            visual = json.loads(r["visual_elements"]) if r["visual_elements"] else []
        except Exception:
            visual = []
        out[n] = {
            "n": n,
            "roman": r["roman_numeral"] or "",
            "stage": (r["alchemical_stage"] or "NIGREDO").upper(),
            "palette": palette,
            "visual_elements": visual,
            "motto": {"la": r["motto_latin"], "en": r["motto_english"]},
            "epigram": {"la": r["epigram_latin"], "en": r["epigram_english"]},
            "discourse": r["discourse_summary"],
            "image_description": r["image_description"],
            "provenance": {
                "source_method": r["source_method"],
                "review_status": r["review_status"],
                "confidence": r["confidence"],
            },
            "readings": [],
            "sources": [],
        }
        eid = r["id"]
        for s in con.execute(
            "select b.author, b.title, b.year, sr.interpretation_type, "
            "sr.summary, sr.section_page, sr.confidence "
            "from scholarly_refs sr join bibliography b on b.id = sr.bib_id "
            "where sr.emblem_id = ?",
            (eid,),
        ):
            s = dict(s)
            if not s["summary"]:
                continue
            out[n]["readings"].append({
                "author": s["author"],
                "title": s["title"],
                "year": s["year"],
                "kind": s["interpretation_type"],
                "page": None if s["section_page"] in (None, "None") else s["section_page"],
                "text": s["summary"],
                "confidence": s["confidence"],
            })
        for s in con.execute(
            "select sa.name, sa.type, sa.author, sa.era, sa.description_long, "
            "es.relationship_type, es.de_jong_page, es.notes "
            "from emblem_sources es "
            "join source_authorities sa on sa.id = es.authority_id "
            "where es.emblem_id = ?",
            (eid,),
        ):
            s = dict(s)
            out[n]["sources"].append({
                "name": s["name"],
                "type": s["type"],
                "author": s["author"],
                "era": s["era"],
                "gloss": ((s["description_long"] or "")[:600] or None),
                "relationship": s["relationship_type"],
                "de_jong_page": s["de_jong_page"],
            })
    # de Jong first in the readings list; she is the project's spine
    for v in out.values():
        v["readings"].sort(key=lambda d: (0 if "de Jong" in (d["author"] or "") else 1))

    # now that readings and sources are attached, build the layered commentary
    for r in con.execute("select id, number from emblems"):
        n = r["number"]
        if n in out:
            out[n]["commentary"] = commentary_for(con, r["id"], out[n])
    con.close()
    return out


# ---------------------------------------------------------------------------
# commentary
# ---------------------------------------------------------------------------
# The tour carries several LEVELS of commentary rather than one blob of prose,
# each with its own archetype so the reader can see at a glance whether they
# are looking at Maier's own words, at de Jong's reading of them, at the
# alchemical text he is citing, or at the myth he is alluding to. The
# archetypes are colour-coded in the panel (site/css/world.css).
#
# Every box is assembled from the Claudiens database and carries its citation.
# Nothing here is composed by this tool: it selects, orders and labels.

ARCHETYPES = [
    ("motto",      "Maier's motto"),
    ("epigram",    "Maier's epigram"),
    ("image",      "What the plate shows"),
    ("discourse",  "Maier's discourse"),
    ("dejong",     "De Jong's analysis"),
    ("historical", "Historical commentary"),
    ("alchemical", "Alchemical text referenced"),
    ("myth",       "Mythological allusion unpacked"),
    ("register",   "The same figure in four registers"),
]

REGISTER_LABELS = [
    ("alchemical", "in the laboratory"),
    ("medical", "in the body"),
    ("spiritual", "in the soul"),
    ("cosmological", "in the heavens"),
]

MYTH_TYPES = {"CLASSICAL", "BIBLICAL", "PATRISTIC"}
TEXT_TYPES = {"ALCHEMICAL", "HERMETIC", "MOVEMENT"}


def commentary_for(con, eid, m):
    """Every level of commentary this emblem has, in reading order."""
    out = []

    def box(arch, title, body, cite=None, note=None, extra=None):
        if not body:
            return
        out.append({
            "archetype": arch,
            "title": title,
            "body": body,
            "cite": cite,
            "note": note,
            **(extra or {}),
        })

    if m["motto"]["la"] or m["motto"]["en"]:
        box("motto", "Maier's motto",
            m["motto"]["en"] or m["motto"]["la"],
            cite="Michael Maier, Atalanta Fugiens (Oppenheim, 1617)",
            extra={"latin": m["motto"]["la"]})

    box("epigram", "Maier's epigram", m["epigram"]["en"],
        cite="Maier's own verse for this emblem, in translation",
        extra={"verse": True, "latin": m["epigram"]["la"]})

    box("image", "What the plate shows", m["image_description"],
        cite="Description of Merian's engraving")

    box("discourse", "Maier's discourse", m["discourse"],
        cite="Summary of Maier's prose discourse (Claudiens corpus extraction)")

    for r in m["readings"]:
        is_dj = "de Jong" in (r["author"] or "")
        cite = "%s, %s (%s)%s" % (
            r["author"], r["title"], r["year"],
            ", " + r["page"] if r["page"] else "")
        box("dejong" if is_dj else "historical",
            "De Jong's analysis" if is_dj else "Historical commentary",
            r["text"], cite=cite,
            note=(r["kind"] or "").lower() or None)

    # The texts and the myths are the same table, split by what kind of
    # authority they are, because "which alchemical book is this quoting" and
    # "which story is this alluding to" are different questions for a reader.
    for src in m["sources"]:
        t = (src["type"] or "").upper()
        if t in TEXT_TYPES:
            arch, title = "alchemical", "Alchemical text referenced"
        elif t in MYTH_TYPES:
            arch, title = "myth", "Mythological allusion unpacked"
        else:
            continue
        body = src["gloss"] or src.get("relationship") or ""
        box(arch, title, body,
            cite=src["name"] + (" — de Jong " + src["de_jong_page"] if src["de_jong_page"] else ""),
            note=src.get("relationship_to_maier"),
            extra={"source_name": src["name"], "source_type": t})

    # dictionary terms: the four-register unpacking is the most distinctive
    # thing the Claudiens corpus holds, and it is exactly "the allusion
    # unpacked" — one figure read in the laboratory, the body, the soul and
    # the heavens at once.
    for r in con.execute(
        "select dt.label, dt.label_latin, dt.category, dt.definition_short, "
        "dt.significance_to_af, dt.registers, ter.context "
        "from term_emblem_refs ter "
        "join dictionary_terms dt on dt.id = ter.term_id "
        "where ter.emblem_id = ?",
        (eid,),
    ):
        r = dict(r)
        regs = {}
        if r["registers"]:
            try:
                regs = json.loads(r["registers"])
            except Exception:
                regs = {}
        lines = [(lab, regs[k]) for k, lab in REGISTER_LABELS if regs.get(k)]
        if lines:
            box("register", r["label"],
                r["significance_to_af"] or r["definition_short"] or "",
                cite="Claudiens dictionary: %s (%s)" % (r["label"], (r["category"] or "").lower()),
                extra={"registers": [{"label": a, "text": b} for a, b in lines],
                       "term": r["label"], "latin": r["label_latin"]})
        elif r["category"] == "SOURCE_TEXT" and r["definition_short"]:
            box("alchemical", r["label"], r["definition_short"],
                cite="Claudiens dictionary: source text")
        elif r["category"] == "FIGURE" and (r["significance_to_af"] or r["definition_short"]):
            box("myth", r["label"], r["significance_to_af"] or r["definition_short"],
                cite="Claudiens dictionary: figure")

    return out


# ---------------------------------------------------------------------------
# metric placement
# ---------------------------------------------------------------------------
def measured_station(solve, elements, eye):
    """Depths from the plate's own pinhole. Mirrors site/js/reconstruct.js."""
    W, H, F = solve["width"], solve["height"], solve["focal_px"]
    YH = solve["horizon_y"]

    cards = []
    for el in elements:
        bx, by, bw, bh = el["bbox"]
        kind = el.get("kind", "standing")
        if kind == "ornament":
            # No ground contact by definition. Park it on the backdrop plane and
            # SAY SO, rather than inventing a depth for it.
            z = 12.0
            basis = "CONJECTURE: ornament, no ground contact; parked on the backdrop plane"
            y_bottom = eye - ((by + bh) - YH) * z / F
        else:
            y = el["contact_y"]
            if y <= YH + 1e-6:
                continue
            z = (F * eye) / (y - YH)
            if z > 400 or z <= 0.2:
                continue
            basis = el.get("contact_basis", "")
            y_bottom = 0.0
        w = bw * z / F
        h = bh * z / F
        x = ((bx + bw / 2) - W / 2) * z / F
        cards.append({
            "file": el["file"],
            "label": el["label"],
            "kind": kind,
            "z_m": round(z, 3),
            "x_m": round(x, 3),
            "y_bottom_m": round(y_bottom, 3),
            "w_m": round(w, 3),
            "h_m": round(h, 3),
            "contact_confidence": el.get("contact_confidence"),
            "basis": basis,
        })
    cards.sort(key=lambda c: -c["z_m"])
    return {"tier": "measured", "cards": cards}


def conjectural_station(elements, plate_w, plate_h):
    """No horizon recoverable. A cut sheet, popped in parallel projection.

    Because the pop is parallel, a card's apparent size never changes: the
    reconstruction makes NO claim about depth, which is exactly the honest
    thing to do when the plate refused to give a horizon.
    """
    sheet_h = FLAT_HEIGHT_M
    sheet_w = sheet_h * (plate_w / plate_h)
    cards = []
    order = sorted(elements, key=lambda e: -(e["bbox"][1] + e["bbox"][3]))
    for i, el in enumerate(order):
        bx, by, bw, bh = el["bbox"]
        w = sheet_w * bw / plate_w
        h = sheet_h * bh / plate_h
        x = (bx + bw / 2 - plate_w / 2) / plate_w * sheet_w
        y_c = (plate_h / 2 - (by + bh / 2)) / plate_h * sheet_h + sheet_h / 2
        cards.append({
            "file": el["file"],
            "label": el["label"],
            "kind": el.get("kind", "standing"),
            "pop_m": round(POP_STEP_M * (i + 1), 3),
            "x_m": round(x, 3),
            "y_center_m": round(y_c, 3),
            "w_m": round(w, 3),
            "h_m": round(h, 3),
            "basis": "CONJECTURE: parallel pop, no depth claimed",
        })
    return {
        "tier": "conjectural",
        "sheet": {"w_m": round(sheet_w, 3), "h_m": round(sheet_h, 3), "depth_m": FLAT_DEPTH_M},
        "cards": cards,
    }


def road_point(i):
    """Station i's road centre (x, z) and the road heading there, in degrees."""
    s = i * BAY_SPACING_M
    x = SWING_AMP_M * math.sin(2 * math.pi * i / SWING_PERIOD)
    dxds = (SWING_AMP_M * 2 * math.pi / (SWING_PERIOD * BAY_SPACING_M)) * math.cos(
        2 * math.pi * i / SWING_PERIOD
    )
    heading = math.degrees(math.atan2(dxds, 1.0))
    return x, -s, heading


def build_routes(route, stations, procs):
    """Three ways through the same world.

    The road is laid out in emblem order because that is the book. A route
    does not move a station; it only chooses the order the tour visits them,
    so the process route is a genuinely different reading of the same terrain
    rather than a second copy of it.
    """
    by_proc = {}
    for key in route:
        pr = procs.get(stations[key]["n"])
        if pr:
            by_proc.setdefault(pr, []).append(key)

    ordered = [p for p in RIPLEY if p in by_proc] +               sorted(p for p in by_proc if p not in RIPLEY)

    process_route = []
    for p in ordered:
        process_route.append({
            "process": p,
            "label": p.capitalize(),
            "gloss": PROCESS_GLOSS.get(p, ""),
            "stations": by_proc[p],
        })

    return {
        "emblem": {
            "id": "emblem",
            "label": "Emblem order",
            "gloss": "The book as Maier printed it, title page to Emblem L.",
            "stations": list(route),
        },
        "process": {
            "id": "process",
            "label": "Order of the work",
            "gloss": "The same fifty-one stations regrouped by the operation each one "
                     "stages, in the order of Ripley's twelve gates: calcination first, "
                     "projection last. The road does not move; only the reading does.",
            "groups": process_route,
            "stations": [k for g in process_route for k in g["stations"]],
        },
    }


def main():
    persp = jload(ROOT / "data" / "perspective.json")
    elems = jload(ROOT / "data" / "elements.json")
    manifest = jload(ROOT / "site" / "assets" / "manifest.json")
    loc = load_locations()
    settings = load_settings()
    procs = load_processes()
    meta = db_rows()

    stations = {}
    route = []
    counts = {"measured": 0, "conjectural": 0}

    for n in range(51):
        key = "emblem-%02d" % n
        solve = persp.get(key, {})
        man = manifest.get(key, {})
        els = (elems.get(key) or {}).get("elements", [])
        m = meta.get(n, {})
        eye = solve.get("eye_height_m") or EYE_DEFAULT_M

        recoverable = bool(
            solve.get("horizon_recoverable") is not False
            and solve.get("horizon_y") is not None
            and solve.get("focal_px")
        )
        rejected = None
        if recoverable:
            f = float(solve["focal_px"])
            h = float(solve.get("height") or man.get("src_h") or 1)
            vfov = 2 * math.degrees(math.atan(h / (2 * f)))
            if not (VFOV_MIN_DEG <= vfov <= VFOV_MAX_DEG):
                recoverable = False
                rejected = (
                    "REJECTED: the solve implies f = %.0f px on a %d px plate, a "
                    "vertical field of view of %.0f degrees. Nothing in this corpus "
                    "was constructed through a lens like that, so the fit is "
                    "spurious (%s) and is recorded rather than adopted. The station "
                    "falls back to the conjectural tier."
                    % (f, h, vfov, solve.get("focal_basis") or "basis unrecorded")
                )
        if recoverable:
            geom = measured_station(solve, els, eye)
        else:
            geom = conjectural_station(
                els,
                man.get("src_w", solve.get("width", 1600)),
                man.get("src_h", solve.get("height", 1373)),
            )
        counts[geom["tier"]] += 1

        setting = loc.get(n, "hillside")
        x, z, heading = road_point(n)

        st = dict(m)
        st.update({
            "key": key,
            "n": n,
            "setting": setting,
            "setting_spec": settings.get(setting, {}),
            "process": procs.get(n),
            "armature_class": solve.get("armature_class"),
            "armature_type": solve.get("type"),
            "armature_basis": solve.get("armature_basis") or solve.get("notes"),
            "plate": {
                "file": man.get("plate", "plates/%s.jpg" % key),
                "w": man.get("src_w", solve.get("width")),
                "h": man.get("src_h", solve.get("height")),
                "focal_px": solve.get("focal_px"),
                "focal_basis": solve.get("focal_basis"),
                "horizon_y": solve.get("horizon_y"),
                "horizon_recoverable": recoverable,
                "eye_height_m": eye,
                "solve_confidence": solve.get("confidence"),
                "solve_reviewed": bool(solve.get("reviewed")),
                "rejected": rejected,
            },
            "ground": man.get("ground"),
            "geometry": geom,
            "world": {
                "road": [round(x, 3), 0.0, round(z, 3)],
                "heading_deg": round(heading, 2),
                "bay_side": 1 if n % 2 == 0 else -1,
                "bay_offset_m": BAY_OFFSET_M,
            },
        })
        stations[key] = st
        route.append(key)

    world = {
        "id": "atalanta",
        "title": "The Fugitive World",
        "subtitle": "Michael Maier, Atalanta Fugiens (Oppenheim, 1617) - all "
                    "fifty-one emblems on one course, walked in the order he "
                    "printed them",
        "audio": "fugues",
        "generated": date.today().isoformat(),
        "generator": "tools/build_world.py",
        "sources": {
            "text": "C:/Dev/Claudiens/db/atalanta.db (emblems, scholarly_refs, "
                    "emblem_sources, source_authorities, bibliography)",
            "geometry": "data/perspective.json + data/elements.json + site/assets/manifest.json",
            "settings": "locations.js (settings read off Maier's own epigrams)",
        },
        "conjectures": {
            "FLAT_HEIGHT_M": FLAT_HEIGHT_M,
            "FLAT_DEPTH_M": FLAT_DEPTH_M,
            "POP_STEP_M": POP_STEP_M,
            "note": "Applied only to the conjectural tier. The measured tier takes "
                    "every number from its plate's own solve.",
        },
        "road": {
            "bay_spacing_m": BAY_SPACING_M,
            "half_width_m": ROAD_HALF_W_M,
            "swing_amp_m": SWING_AMP_M,
            "swing_period": SWING_PERIOD,
            "length_m": round(BAY_SPACING_M * 50, 1),
        },
        "stage_order": STAGE_ORDER,
        # The alchemical stages, high-key on purpose: an engraving is ink on a
        # light sheet even at its blackest, and a NIGREDO that reads as night
        # stops reading as a print.
        "stage_colours": {
            "NIGREDO": {"tint": 0xc3bbad, "sky": 0x9a938a},
            "ALBEDO": {"tint": 0xf7f3e9, "sky": 0xeee9dc},
            "CITRINITAS": {"tint": 0xeedfab, "sky": 0xe2d09a},
            "RUBEDO": {"tint": 0xe3b79c, "sky": 0xd3a184},
        },
        "path": [[st["world"]["road"][0], st["world"]["road"][2]]
                 for st in (stations[k] for k in route)],
        "tier_counts": counts,
        "route": route,
        "routes": build_routes(route, stations, procs),
        "stations": stations,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(world, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote %s  %d stations  measured=%d conjectural=%d  %.0f kB" % (
        OUT.relative_to(ROOT), len(route), counts["measured"],
        counts["conjectural"], OUT.stat().st_size / 1024))


if __name__ == "__main__":
    main()

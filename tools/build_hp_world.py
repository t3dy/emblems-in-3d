#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_hp_world.py - compile site/data/worlds/poliphilo.json, the second world.

Where the Atalanta world had to invent its connective tissue (a race course,
because the book is a race but not a place), the *Hypnerotomachia Poliphili*
needs none. It is already a journey. Poliphilo falls asleep, wakes lost in a
dark wood, and walks: to the great pyramid and its ruins, through the dragon's
tunnel, into the palace of Queen Eleuterylida, past the five senses and the
three doors, over the Polyandrion of ruined tombs, to the fountain and temple
of Venus, into the triumphal procession, aboard Cupid's boat, and ashore on
Cythera. Then Polia tells the whole thing again in her own voice.

So this world is **precincts, not a road**. Thirteen places, in the order the
book reaches them, each holding its own leaves arranged in an arc you stand in
the middle of and turn around inside. The path threads them.

    site/assets/hp/manifest.json   the 129 leaves (whole, never cropped) and
                                   the woodcut rectangle located on each
    C:/Dev/hypnerotomachia polyphili/db/hp.db
                                   woodcuts: title, chapter_context,
                                   description, narrative_context,
                                   scholarly_discussion, depicted_elements,
                                   dictionary_terms; woodcut_catalog:
                                   narrative_section; dictionary_terms;
                                   scholars and bibliography

Every station is tier "leaf": the whole 1499 page stands as a sheet, and where
the detector was confident the woodcut pops forward off it in PARALLEL
projection - no depth is claimed, exactly as the Atalanta world's conjectural
tier claims none. There are no perspective solves for this corpus, and this
file does not pretend otherwise.

Usage:  python tools/build_hp_world.py
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HP_DB = Path(r"C:/Dev/hypnerotomachia polyphili/db/hp.db")
HP_MANIFEST = ROOT / "site" / "assets" / "hp" / "manifest.json"
OUT = ROOT / "site" / "data" / "worlds" / "poliphilo.json"

# --- the sheet ---------------------------------------------------------------
LEAF_HEIGHT_M = 5.00   # CONJECTURE: a 1499 folio standing in a dream is this tall
POP_M = 0.30           # CONJECTURE: how far a located woodcut stands off its leaf
EYE_M = 1.62

# --- the precincts -----------------------------------------------------------
# Each place, its generated setting archetype, and the colour it dreams in.
# The gloss is the place as the book describes it, not as we invented it.
PRECINCTS = {
    "DARK_FOREST": {
        "label": "The Dark Wood",
        "setting": "forest",
        "tint": 0x9d968a, "sky": 0x7d776f,
        "gloss": "Poliphilo, having wept himself to sleep for Polia, wakes inside "
                 "his own dream in a selva oscura. Dante's wood, and the threshold "
                 "of every dream narrative: he is lost before anything begins.",
    },
    "PYRAMID_RUINS": {
        "label": "The Great Pyramid and the Ruins",
        "setting": "pyramid",
        "tint": 0xcfc3a8, "sky": 0xb5ac9a,
        "gloss": "An enormous stepped pyramid crowned by an obelisk, and around it "
                 "the wreckage of an antiquity that never existed. Colonna measures "
                 "it, quotes its inscriptions in four scripts, and will not stop "
                 "describing it - the book's first great architectural set piece.",
    },
    "DRAGON_PORTAL": {
        "label": "The Dragon's Tunnel",
        "setting": "portal",
        "tint": 0x8f8779, "sky": 0x6f6a62,
        "gloss": "Poliphilo flees into the dark under the pyramid and is chased by "
                 "a dragon through a lightless passage. The one moment of real "
                 "terror in the dream, and the passage out of antiquity into the "
                 "pleasant country beyond.",
    },
    "QUEEN_PALACE": {
        "label": "The Palace of Eleuterylida",
        "setting": "palace",
        "tint": 0xe6dcc0, "sky": 0xd8cfba,
        "gloss": "The court of Queen Free-Will, where Poliphilo is bathed, fed at a "
                 "banquet of impossible courses, and shown a garden of glass and a "
                 "garden of silk. Colonna's fullest fantasy of magnificence.",
    },
    "FIVE_SENSES": {
        "label": "The Five Nymphs",
        "setting": "garden",
        "tint": 0xe8dfc6, "sky": 0xdcd3bc,
        "gloss": "Five nymphs - the five senses - lead Poliphilo to the bath and "
                 "then onward. The allegory is explicit and cheerful, and the "
                 "book's erotic temperature rises from here.",
    },
    "JOURNEY_DOORS": {
        "label": "The Three Doors",
        "setting": "doors",
        "tint": 0xdcd2b8, "sky": 0xcac2ae,
        "gloss": "Gloria Dei, Gloria Mundi, Mater Amoris. Poliphilo chooses the "
                 "third, the mother of love, and the choice decides the rest of the "
                 "dream. The Herculean choice, set as a doorway.",
    },
    "POLYANDRION": {
        "label": "The Polyandrion",
        "setting": "tomb",
        "tint": 0xa8a190, "sky": 0x8c867c,
        "gloss": "A vast ruined burial ground of those who died for love, its "
                 "epitaphs copied out in Latin, Greek, Hebrew and Arabic. The "
                 "longest and strangest digression in the book, and the darkest.",
    },
    "VENUS_FOUNTAIN": {
        "label": "The Fountain of Venus",
        "setting": "fountain",
        "tint": 0xe4dcc4, "sky": 0xd6cfb8,
        "gloss": "The sleeping Venus at her fountain, and the water that Poliphilo "
                 "must not disturb. The hinge between the architectural half of the "
                 "dream and the amorous one.",
    },
    "VENUS_TEMPLE": {
        "label": "The Temple of Venus Physizoa",
        "setting": "temple",
        "tint": 0xecdfc0, "sky": 0xded2b6,
        "gloss": "Where Poliphilo and Polia are joined by the priestess, with rites "
                 "Colonna describes in more liturgical detail than any real rite of "
                 "his century. The book's sacramental centre.",
    },
    "PROCESSION": {
        "label": "The Triumphs",
        "setting": "processionway",
        "tint": 0xf0e3c2, "sky": 0xe4d8bc,
        "gloss": "Four triumphal cars of Jupiter's loves, then the triumph of "
                 "Vertumnus and Pomona, then Priapus. Antiquarian pageantry that "
                 "fed a century of court festival design across Europe.",
    },
    "CYTHERA_VOYAGE": {
        "label": "The Voyage",
        "setting": "shore",
        "tint": 0xdfe0d4, "sky": 0xcfd4cc,
        "gloss": "Cupid himself takes the tiller and the lovers are rowed to the "
                 "island by nymphs, dolphins keeping pace. The dream's one open "
                 "horizon.",
    },
    "CYTHERA_GARDENS": {
        "label": "The Island of Cythera",
        "setting": "cythera",
        "tint": 0xf3e8c6, "sky": 0xe8dcbe,
        "gloss": "A perfect circle of a garden, laid out in twenty concentric zones "
                 "around the amphitheatre of Venus, measured to the foot. The most "
                 "influential garden that was never built.",
    },
    "BOOK_II_POLIA": {
        "label": "Polia's Own Account",
        "setting": "library",
        "tint": 0xe0d8c2, "sky": 0xd0c9b6,
        "gloss": "The second book, in which Polia tells the whole story again from "
                 "her side - her vow of chastity, the plague, her cruelty and her "
                 "relenting. Then Poliphilo wakes, and she vanishes.",
    },
}

# --- layout ------------------------------------------------------------------
PRECINCT_GAP_M = 108.0    # distance along the path between precinct centres
SWING_M = 52.0            # how far the path wanders sideways
ARC_SPACING_M = 7.2       # along-arc distance between neighbouring leaves
ARC_RADIUS_MIN = 10.0
ARC_RADIUS_MAX = 22.0
ARC_SPAN_DEG = 205.0      # how far round you the leaves of a precinct wrap
ARC_MAX_PER_RING = 14     # beyond this a precinct gets a second, outer ring
PATH_SAMPLES = 9          # polyline points between consecutive precincts


def load_manifest():
    return json.loads(HP_MANIFEST.read_text(encoding="utf-8"))["items"]


def db():
    con = sqlite3.connect(str(HP_DB))
    con.row_factory = sqlite3.Row
    return con


def commentary_for(con, w, terms_by_slug):
    """The layered commentary, in the same shape the Atalanta world uses."""
    out = []

    def box(arch, title, body, cite=None, note=None, extra=None):
        if not body:
            return
        out.append({"archetype": arch, "title": title, "body": body,
                    "cite": cite, "note": note, **(extra or {})})

    box("title", w["title"] or w["slug"],
        w["chapter_context"],
        cite="Francesco Colonna, Hypnerotomachia Poliphili (Venice: Aldus Manutius, 1499), "
             "sig. %s, p. %s" % (w["signature_1499"] or "?", w["page_1499"]))

    box("image", "What the cut shows", w["description"],
        cite="Description of the 1499 woodcut",
        note=(w["subject_category"] or "").lower() or None)

    box("narrative", "Where this is in the dream", w["narrative_context"],
        cite="Narrative placement in the Hypnerotomachia")

    box("scholarship", "What scholars say", w["scholarly_discussion"],
        cite=w["source_basis"] or "Claudiens-style corpus extraction from the HP bibliography")

    if w["influence"]:
        box("influence", "What it went on to do", w["influence"],
            cite="Reception and influence")

    if w["depicted_elements"]:
        box("elements", "Depicted", w["depicted_elements"],
            cite="Elements catalogued on this cut")

    for slug in (w["dictionary_terms"] or "").split(","):
        slug = slug.strip()
        t = terms_by_slug.get(slug)
        if not t:
            continue
        body = t["significance_to_hp"] or t["definition_long"] or t["definition_short"]
        if not body:
            continue
        box("term", t["label"], body,
            cite="Hypnerotomachia dictionary: %s (%s)" % (t["label"], (t["category"] or "").lower()),
            extra={"term": t["label"]})

    if w["alchemical_annotation"]:
        box("marginalia", "An alchemist read this page",
            "This leaf carries alchemical marginalia in one of the annotated copies. "
            "Sixteenth- and seventeenth-century readers took the Hypnerotomachia as "
            "an alchemical allegory and wrote their readings into the margins - which "
            "is the thread that ties this book to Atalanta Fugiens next door.",
            cite="hp.db woodcuts.alchemical_annotation; annotation density %s"
                 % (w["annotation_density"] or "unrecorded"))

    return out


def build():
    man = load_manifest()
    con = db()

    terms_by_slug = {}
    for t in con.execute("select * from dictionary_terms"):
        terms_by_slug[t["slug"]] = dict(t)

    rows = [dict(r) for r in con.execute(
        "select w.*, wc.narrative_section "
        "from woodcuts w left join woodcut_catalog wc "
        "  on wc.catalog_number = w.catalog_number "
        "where w.page_1499 is not null order by w.page_1499")]

    # group into precincts, in the order the book reaches them
    groups = {}
    for r in rows:
        sec = r["narrative_section"] or "DARK_FOREST"
        groups.setdefault(sec, []).append(r)
    order = sorted(groups, key=lambda s: min(x["page_1499"] for x in groups[s]))

    stations, route, precincts, path = {}, [], [], []
    for pi, sec in enumerate(order):
        members = sorted(groups[sec], key=lambda x: x["page_1499"])
        spec = PRECINCTS.get(sec, {
            "label": sec.replace("_", " ").title(), "setting": "hillside",
            "tint": 0xd8d0bc, "sky": 0xc8c1ae, "gloss": "",
        })

        # the precinct centre, on a path that wanders as it advances
        cz = -PRECINCT_GAP_M * pi
        cx = SWING_M * math.sin(pi * 0.83)
        for k in range(PATH_SAMPLES):
            t = k / PATH_SAMPLES
            z = cz - PRECINCT_GAP_M * t
            x = SWING_M * math.sin((pi + t) * 0.83)
            path.append([round(x, 2), round(z, 2)])

        # Rings. A precinct you stand in the middle of stops reading as a place
        # once its arc is more than about fourteen leaves wide, so a big one
        # (Cythera has thirty) gets a second ring standing behind the first.
        m = len(members)
        rings = max(1, math.ceil(m / ARC_MAX_PER_RING))
        span = math.radians(ARC_SPAN_DEG)
        per = math.ceil(m / rings)
        radius0 = min(ARC_RADIUS_MAX,
                      max(ARC_RADIUS_MIN, ARC_SPACING_M * per / span))
        radius = radius0 + (rings - 1) * 8.5
        keys = []

        for i, w in enumerate(members):
            key = "hp-%03d" % w["page_1499"]
            leaf = man.get(key)
            if not leaf:
                continue
            keys.append(key)

            # arc position, opening toward the path you arrive on (+Z)
            ring = i // per
            j = i % per
            n_in_ring = min(per, m - ring * per)
            rr_ = radius0 + ring * 8.5
            a = -span / 2 + (span * (j + 0.5) / n_in_ring)
            x = cx + math.sin(a) * rr_
            z = cz - math.cos(a) * rr_
            face = math.degrees(math.atan2(cx - x, cz - z))   # look back at the centre

            aspect = leaf["web_w"] / leaf["web_h"]
            h = LEAF_HEIGHT_M
            wm = h * aspect

            cut = leaf.get("woodcut")
            cards = []
            if cut and cut.get("poppable"):
                cards.append({
                    "label": "the woodcut",
                    "kind": "woodcut",
                    "uv": [cut["nx0"], cut["ny0"], cut["nx1"], cut["ny1"]],
                    "w_m": round(wm * (cut["nx1"] - cut["nx0"]), 3),
                    "h_m": round(h * (cut["ny1"] - cut["ny0"]), 3),
                    "x_m": round(wm * ((cut["nx0"] + cut["nx1"]) / 2 - 0.5), 3),
                    "y_center_m": round(h * (1 - (cut["ny0"] + cut["ny1"]) / 2), 3),
                    "pop_m": POP_M,
                    "confidence": cut["confidence"],
                    "basis": "CONJECTURE: the located woodcut popped off its own leaf in "
                             "parallel projection. No depth is claimed; the leaf behind "
                             "it is whole and uncropped.",
                })

            stations[key] = {
                "key": key,
                "n": w["page_1499"],
                "title": w["title"] or w["slug"],
                "slug": w["slug"],
                "stage": sec,
                "section": sec,
                "section_label": spec["label"],
                "setting": spec["setting"],
                "signature": w["signature_1499"],
                "page": w["page_1499"],
                "subject_category": w["subject_category"],
                "provenance": {
                    "source_method": w["source_method"],
                    "review_status": w["review_status"],
                    "confidence": w["confidence"],
                },
                "plate": {
                    "file": leaf["plate"],
                    "w": leaf["web_w"], "h": leaf["web_h"],
                    "horizon_recoverable": False,
                    "eye_height_m": EYE_M,
                    "focal_px": None, "horizon_y": None,
                    "solve_reviewed": False,
                    "rejected": None,
                    "woodcut": cut,
                    "detector_note": leaf["detector"].get("why"),
                },
                "geometry": {
                    "tier": "leaf",
                    "sheet": {"w_m": round(wm, 3), "h_m": h, "depth_m": 0.0},
                    "cards": cards,
                },
                "world": {
                    "pos": [round(x, 2), 0.0, round(z, 2)],
                    "face_deg": round(face, 2),
                    "road": [round(cx, 2), 0.0, round(cz, 2)],
                    "heading_deg": 0.0,
                    "bay_side": 1,
                    "bay_offset_m": 0.0,
                },
                "commentary": commentary_for(con, w, terms_by_slug),
            }
            route.append(key)

        precincts.append({
            "id": sec,
            "label": spec["label"],
            "gloss": spec["gloss"],
            "setting": spec["setting"],
            "centre": [round(cx, 2), 0.0, round(cz, 2)],
            "radius_m": round(radius, 1),
            "stations": keys,
        })

    con.close()

    stage_colours = {sec: {"tint": PRECINCTS.get(sec, {}).get("tint", 0xd8d0bc),
                           "sky": PRECINCTS.get(sec, {}).get("sky", 0xc8c1ae)}
                     for sec in order}

    world = {
        "id": "poliphilo",
        "title": "The Dream of Poliphilo",
        "subtitle": "Francesco Colonna, Hypnerotomachia Poliphili (Venice: Aldus "
                    "Manutius, 1499) - one hundred and twenty-nine leaves, thirteen "
                    "precincts, walked in the order the dream reaches them",
        "generated": date.today().isoformat(),
        "generator": "tools/build_hp_world.py",
        "sources": {
            "text": "C:/Dev/hypnerotomachia polyphili/db/hp.db (woodcuts, "
                    "woodcut_catalog, dictionary_terms)",
            "images": "site/assets/hp/ - whole 1499 leaves, never cropped; see "
                      "tools/build_hp_assets.py",
        },
        "conjectures": {
            "LEAF_HEIGHT_M": LEAF_HEIGHT_M,
            "POP_M": POP_M,
            "note": "There are no perspective solves for this corpus. Every station "
                    "is a whole leaf standing at an invented height, with the located "
                    "woodcut popped off it in parallel projection. Nothing here "
                    "claims a depth.",
        },
        "stage_order": order,
        "stage_colours": stage_colours,
        "tier_counts": {"leaf": len(route), "measured": 0},
        "precincts": precincts,
        "path": path,
        "road": {"half_width_m": 2.4, "bay_spacing_m": PRECINCT_GAP_M,
                 "length_m": round(PRECINCT_GAP_M * (len(order) - 1), 1)},
        "route": route,
        "routes": {
            "emblem": {
                "id": "emblem",
                "label": "The dream in order",
                "gloss": "The book as Aldus printed it, from the dark wood to Polia's "
                         "own account - which is also the order Poliphilo walks.",
                "stations": list(route),
            },
            "process": {
                "id": "process",
                "label": "By kind of cut",
                "gloss": "The same leaves regrouped by what the block depicts: "
                         "landscape, architecture, narrative, procession, hieroglyph, "
                         "diagram, portrait, ornament. Colonna's book is an argument "
                         "about images, and this is that argument sorted.",
                "groups": [],
                "stations": [],
            },
        },
        "stations": stations,
    }

    # the second route: by subject category, in a deliberate order
    cat_order = ["LANDSCAPE", "ARCHITECTURAL", "NARRATIVE", "PROCESSION",
                 "HIEROGLYPHIC", "DIAGRAM", "PORTRAIT", "DECORATIVE"]
    by_cat = {}
    for k in route:
        by_cat.setdefault(stations[k]["subject_category"] or "DECORATIVE", []).append(k)
    groups = []
    for c in cat_order + sorted(x for x in by_cat if x not in cat_order):
        if c in by_cat:
            groups.append({"process": c.lower(), "label": c.title(),
                           "gloss": "", "stations": by_cat[c]})
    world["routes"]["process"]["groups"] = groups
    world["routes"]["process"]["stations"] = [k for g in groups for k in g["stations"]]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(world, ensure_ascii=False, indent=1), encoding="utf-8")
    boxes = sum(len(s["commentary"]) for s in stations.values())
    pops = sum(1 for s in stations.values() if s["geometry"]["cards"])
    print("wrote %s  %d leaves in %d precincts  %d commentary boxes  %d woodcuts pop  %.0f kB"
          % (OUT.relative_to(ROOT), len(route), len(precincts), boxes, pops,
             OUT.stat().st_size / 1024))


if __name__ == "__main__":
    build()

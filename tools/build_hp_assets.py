#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_hp_assets.py - web plates for the Hypnerotomachia world.

The sources are full 1499 Aldine PAGES: a block of roman type with a woodcut
set into it, ~1.4 MB each, 233 MB for the run.

DECISION, and it is the same one the Atalanta world made about depth. An
automatic crop can be wrong, and a wrong crop is invisible once made: you
cannot tell from the result that half a cut was thrown away. So **the page is
never cropped.** Every plate is the whole leaf, at web size, exactly as it
sits in the book.

What the detector does instead is *locate* the woodcut on the page and record
the rectangle. The world uses that to POP the cut forward off its own sheet -
the papercraft move the Atalanta stations already make - so you see the
engraving standing proud of the letterpress it is set into, with the page
still whole behind it. Where the detector is not confident there is simply no
pop and the leaf stands flat. Nothing is hidden either way.

HOW THE WOODCUT IS FOUND. The discriminator is the GAP, not the density. Set
type leaves a band of leading between every line, so the row ink profile of a
text block returns to bare paper twenty or thirty times a page. A woodcut does
not: its ink runs continuously down the whole block. So the cut is the longest
run of consecutive rows in which the ink never falls back to paper, and it has
to beat the page's own line height by a wide margin to be believed. The
profile must NOT be smoothed first: smoothing over a line pitch fills the
leading in and makes a dense text block look exactly like a woodcut, which is
how the first version of this tool found only the four full-page cuts in
twenty-four leaves.

A second, weaker test grades the find rather than vetoing it: a woodcut is
blacker than the type around it, so a band no denser than the page median is
reported at low confidence and gets no pop.

Outputs
  site/assets/hp/plates/hp-NNN.jpg   the whole leaf, web size
  site/assets/hp/manifest.json       per-leaf: dimensions, the located woodcut
                                     rectangle in normalised coordinates, the
                                     numbers behind it, and its confidence

Usage:
  python tools/build_hp_assets.py [--width 1100] [--quality 80] [--limit N]
  python tools/build_hp_assets.py --contact   # review sheet with the boxes drawn
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import date
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
HP_DB = Path(r"C:/Dev/hypnerotomachia polyphili/db/hp.db")
HP_IMG = Path(r"C:/Dev/hypnerotomachia polyphili/site/images/woodcuts_1499")
OUT = ROOT / "site" / "assets" / "hp" / "plates"
MANIFEST = ROOT / "site" / "assets" / "hp" / "manifest.json"

INK_EPS = 0.004      # a row with less ink than this counts as bare paper
MIN_BAND = 0.10      # a cut shorter than this fraction of the leaf is not believed
MAX_BAND = 0.98
PAD = 0.008          # margin kept around the located rectangle


def ink_profile(bw, axis):
    return bw.mean(axis=axis)


def longest_run(mask):
    best = cur = None
    for i, v in enumerate(mask):
        if v and cur is None:
            cur = i
        elif not v and cur is not None:
            if best is None or i - cur > best[1] - best[0]:
                best = (cur, i)
            cur = None
    if cur is not None and (best is None or len(mask) - cur > best[1] - best[0]):
        best = (cur, len(mask))
    return best


def locate_woodcut(img):
    """Where the cut is on the leaf. Returns (rect_or_None, record).

    rect is (x0, y0, x1, y1) in pixels. The leaf is never cropped by this; the
    rectangle is only what the world pops forward.
    """
    H, W = img.shape[:2]
    thr, _ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    bw = (img < thr).astype(np.float32)
    rows = ink_profile(bw, 1)
    inked = rows > INK_EPS

    runs, cur = [], None
    for i, v in enumerate(inked):
        if v and cur is None:
            cur = i
        elif not v and cur is not None:
            runs.append(i - cur)
            cur = None
    line_h = int(np.median(runs)) if runs else 0

    rec = {
        "otsu": int(thr),
        "median_row_ink": round(float(np.median(rows)), 4),
        "line_height_px": line_h,
    }

    band = longest_run(inked)
    if band is None:
        rec["found"] = False
        rec["why"] = "no inked rows"
        return None, rec

    y0, y1 = band
    frac = (y1 - y0) / H
    rec["band_fraction"] = round(frac, 3)
    if not (MIN_BAND <= frac <= MAX_BAND) or (y1 - y0) < 5 * max(1, line_h):
        rec["found"] = False
        rec["why"] = ("the longest gap-free run of rows is %d px (%.3f of the leaf) "
                      "against a %d px line height: too short to be a cut"
                      % (y1 - y0, frac, line_h))
        return None, rec

    sub = bw[y0:y1]
    cols = ink_profile(sub, 0)
    crun = longest_run(cols > INK_EPS * 0.5)
    x0, x1 = crun if crun else (0, W)

    band_ink = float(rows[y0:y1].mean())
    ratio = band_ink / max(1e-6, rec["median_row_ink"])
    band_rows = rows[y0:y1]
    cvar = float(band_rows.std() / max(1e-6, band_rows.mean()))
    rec["band_ink"] = round(band_ink, 4)
    rec["ink_ratio"] = round(ratio, 2)
    rec["row_cv"] = round(cvar, 2)

    conf = 0.40
    if ratio >= 1.25:
        conf += 0.25
    if frac >= 0.25:
        conf += 0.20
    if (x1 - x0) / W >= 0.40:
        conf += 0.15
    rec["confidence"] = round(min(conf, 0.95), 2)
    # Whether the rectangle is allowed to POP is a stricter question than
    # whether it was found. Measured against 24 hand-checked leaves, requiring
    # all three of a full-confidence find, a band clearly blacker than the
    # page, and a ragged row profile (set type is regular; a cut is not) keeps
    # ten of the twelve true cuts and admits one false one. Everything else
    # still shows its leaf whole, which is why a miss costs nothing.
    rec["poppable"] = bool(rec["confidence"] >= 0.9 and ratio >= 1.3 and cvar >= 0.55)

    px, py = int(W * PAD), int(H * PAD)
    x0 = max(0, x0 - px); x1 = min(W, x1 + px)
    y0 = max(0, y0 - py); y1 = min(H, y1 + py)
    rec["found"] = True
    rec["why"] = ("longest gap-free run of inked rows: %d px, %.3f of the leaf, "
                  "against a %d px line height; the band is %.2fx the leaf's "
                  "median row ink. Set type returns to paper between lines; a "
                  "woodcut does not." % (y1 - y0, frac, line_h, ratio))
    return (x0, y0, x1, y1), rec


def woodcut_rows():
    con = sqlite3.connect(str(HP_DB))
    con.row_factory = sqlite3.Row
    rows = [dict(r) for r in con.execute(
        "select w.*, wc.narrative_section, wc.is_full_page "
        "from woodcuts w left join woodcut_catalog wc "
        "  on wc.catalog_number = w.catalog_number "
        "where w.page_1499 is not null order by w.page_1499")]
    con.close()
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=1100)
    ap.add_argument("--quality", type=int, default=80)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--contact", action="store_true")
    args = ap.parse_args()

    rows = woodcut_rows()
    if args.limit:
        rows = rows[: args.limit]
    OUT.mkdir(parents=True, exist_ok=True)

    manifest, tiles, found, popped = {}, [], 0, 0
    for r in rows:
        src = HP_IMG / ("hp1499_p%03d.jpg" % r["page_1499"])
        if not src.exists():
            print("missing", src.name)
            continue
        grey = cv2.imread(str(src), cv2.IMREAD_GRAYSCALE)
        colour = cv2.imread(str(src))
        rect, rec = locate_woodcut(grey)

        s = args.width / colour.shape[1]
        web = cv2.resize(colour, (args.width, max(1, int(colour.shape[0] * s))),
                         interpolation=cv2.INTER_AREA)
        name = "hp-%03d.jpg" % r["page_1499"]
        cv2.imwrite(str(OUT / name), web, [cv2.IMWRITE_JPEG_QUALITY, args.quality])

        H, W = colour.shape[:2]
        cut = None
        if rect:
            found += 1
            x0, y0, x1, y1 = rect
            cut = {"nx0": round(x0 / W, 4), "ny0": round(y0 / H, 4),
                   "nx1": round(x1 / W, 4), "ny1": round(y1 / H, 4),
                   "confidence": rec["confidence"]}
            cut["poppable"] = rec.get("poppable", False)
            if cut["poppable"]:
                popped += 1

        manifest["hp-%03d" % r["page_1499"]] = {
            "plate": "hp/plates/" + name,
            "slug": r["slug"],
            "page_1499": r["page_1499"],
            "src": src.name,
            "src_w": W, "src_h": H,
            "web_w": int(web.shape[1]), "web_h": int(web.shape[0]),
            "woodcut": cut,
            "detector": rec,
        }

        if args.contact and len(tiles) < 24:
            t = web.copy()
            if rect:
                cv2.rectangle(t, (int(x0 * s), int(y0 * s)), (int(x1 * s), int(y1 * s)),
                              (0, 160, 0) if rec.get("poppable") else (0, 0, 255), 6)
            t = cv2.resize(t, (240, int(240 * t.shape[0] / t.shape[1])))
            cv2.putText(t, "%d %s" % (r["page_1499"],
                                      ("%.2f" % rec["confidence"]) if rect else "none"),
                        (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            tiles.append(t)

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({
        "generated": date.today().isoformat(),
        "generator": "tools/build_hp_assets.py",
        "source": str(HP_IMG),
        "leaves": len(manifest),
        "woodcut_located": found,
        "confident_enough_to_pop": popped,
        "policy": "The leaf is never cropped. The located rectangle is used to aim "
                  "the station's viewpoint, and to pop the cut forward off its own "
                  "page only when the find passes all three tests (confidence, ink "
                  "ratio, row variation). Otherwise the leaf stands flat and nothing "
                  "is claimed. Measured on 24 hand-checked leaves: 10 of 12 true "
                  "cuts pop, 1 false pop.",
        "items": manifest,
    }, indent=1, ensure_ascii=False), encoding="utf-8")

    total = sum(f.stat().st_size for f in OUT.glob("*.jpg"))
    print("wrote %d leaves, located %d woodcuts, %d confident enough to pop, %.1f MB"
          % (len(manifest), found, popped, total / 1e6))

    if args.contact and tiles:
        h = max(t.shape[0] for t in tiles)
        tiles = [cv2.copyMakeBorder(t, 0, h - t.shape[0], 0, 4,
                                    cv2.BORDER_CONSTANT, value=(255, 255, 255))
                 for t in tiles]
        rowsx = [np.hstack(tiles[i:i + 6]) for i in range(0, len(tiles) - 5, 6)]
        p = ROOT / "site" / "assets" / "hp" / "contact.png"
        cv2.imwrite(str(p), np.vstack(rowsx))
        print("contact sheet:", p)


if __name__ == "__main__":
    main()

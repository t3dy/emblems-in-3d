#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_hatch_tam.py - a tonal art map cut from Merian's own burin.

PROPOSAL_PHASE6.md sec. 3: built geometry in this project looks like plastic
standing next to a cutout, because the cutouts are 1617 engraving and the walls
are shaded polygons. The fix is Praun/Hoppe/Webb/Finkelstein's *Real-Time
Hatching* - a mip-chain of hatch images indexed by tone, blended per fragment -
with one corpus-specific twist that turns it from a style filter into a
reconstruction: **build the hatch tiles out of the plates themselves.**

So this tool does not draw hatching. It goes looking for it. For every 256 px
window of every Atalanta plate it measures

  ink      the fraction of the window that is ink, after Otsu - i.e. TONE
  coherence  the structure-tensor coherence, which is near 1 where the marks
             are long parallel strokes and near 0 in faces, foliage and
             cross-hatched mush

and then, for each of six tone bins, keeps the most coherent window it can
find: the purest passage of parallel burin work in the whole book at that
darkness. Those six become the TAM. Every wall in the world is then shaded
with actual strokes Merian cut, and the provenance of each tile - plate,
pixel window, measured tone and coherence - is written out beside it.

Outputs
  site/assets/hatch/tam.png       six 256x256 tiles in one 1536x256 strip,
                                  light to dark, each made seamlessly tileable
  site/assets/hatch/tam.json      the provenance record for the six

Usage:  python tools/build_hatch_tam.py [--src DIR] [--tile 256]
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "site" / "assets" / "plates"
OUT_DIR = ROOT / "site" / "assets" / "hatch"

# Six tone bins, light to dark. These are ink-fraction targets, spaced so the
# blend between neighbouring tiles is roughly perceptually even.
TONE_TARGETS = [0.06, 0.14, 0.25, 0.38, 0.53, 0.70]
BIN_HALFWIDTH = 0.04
STRIDE_FRAC = 0.5          # window stride as a fraction of the tile size
MIN_COHERENCE = 0.0        # keep the best whatever it is; report what we got


def structure_tensor_coherence(gray: np.ndarray) -> float:
    """Mean coherence of the structure tensor: 1 = one stroke direction, 0 = none.

    coherence = (l1 - l2) / (l1 + l2) of the smoothed gradient covariance.
    This is the same field PROPOSAL_PHASE6 sec. 2 proposes for shape-from-hatching;
    here it is used only as a purity score for tile selection.
    """
    g = gray.astype(np.float32) / 255.0
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    k = (9, 9)
    jxx = cv2.GaussianBlur(gx * gx, k, 0)
    jyy = cv2.GaussianBlur(gy * gy, k, 0)
    jxy = cv2.GaussianBlur(gx * gy, k, 0)
    tr = jxx + jyy
    det_term = np.sqrt(np.maximum((jxx - jyy) ** 2 + 4 * jxy ** 2, 0.0))
    coh = np.where(tr > 1e-6, det_term / (tr + 1e-6), 0.0)
    # weight by gradient energy so blank paper does not vote
    w = tr
    if w.sum() < 1e-6:
        return 0.0
    return float((coh * w).sum() / w.sum())


def make_tileable(tile: np.ndarray) -> np.ndarray:
    """Offset-and-cross-fade so the tile wraps without a visible seam.

    Roll by half in both axes, which puts the old seams in the middle, then
    cross-fade the middle band back against the unrolled copy. Standard, and it
    preserves stroke direction, which a mirror would not.
    """
    h, w = tile.shape[:2]
    a = tile.astype(np.float32)
    # b tiles cleanly at the EDGES (a's mismatch is rolled to the centre);
    # a is clean at the CENTRE. Take b everywhere except near the centre cross,
    # where we fade back to a.
    b = np.roll(np.roll(a, h // 2, axis=0), w // 2, axis=1)

    def profile(n, band):
        """1 outside the band, smoothly 0 at the band's centre."""
        p = np.ones(n, np.float32)
        c = n // 2
        t = np.abs(np.linspace(-1.0, 1.0, band, dtype=np.float32))
        t = t * t * (3.0 - 2.0 * t)          # smoothstep: 0 at centre, 1 at edges
        p[c - band // 2: c - band // 2 + band] = t
        return p

    band_x = max(16, w // 2)
    band_y = max(16, h // 2)
    m = np.minimum(profile(w, band_x)[None, :], profile(h, band_y)[:, None])
    out = b * m + a * (1.0 - m)
    return np.clip(out, 0, 255).astype(np.uint8)


def scan(paths, tile: int):
    """Best (coherence) window per tone bin across the whole corpus."""
    best = [None] * len(TONE_TARGETS)
    stride = max(16, int(tile * STRIDE_FRAC))

    for p in paths:
        img = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        # Otsu once per plate: the ink threshold is a property of the plate's
        # own scan, not a global constant.
        thr, _ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        ink = (img < thr).astype(np.float32)
        H, W = img.shape
        for y in range(0, H - tile + 1, stride):
            for x in range(0, W - tile + 1, stride):
                win_ink = float(ink[y:y + tile, x:x + tile].mean())
                for i, t in enumerate(TONE_TARGETS):
                    if abs(win_ink - t) > BIN_HALFWIDTH:
                        continue
                    win = img[y:y + tile, x:x + tile]
                    coh = structure_tensor_coherence(win)
                    if coh < MIN_COHERENCE:
                        continue
                    if best[i] is None or coh > best[i]["coherence"]:
                        best[i] = {
                            "bin": i,
                            "tone_target": t,
                            "tone_measured": round(win_ink, 4),
                            "coherence": round(coh, 4),
                            "plate": p.name,
                            "window_px": [x, y, tile, tile],
                            "otsu": int(thr),
                            "_img": win.copy(),
                        }
    return best


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(SRC))
    ap.add_argument("--tile", type=int, default=256)
    args = ap.parse_args()

    paths = sorted(Path(args.src).glob("*.jpg"))
    if not paths:
        raise SystemExit("no plates found in %s" % args.src)
    print("scanning %d plates for hatch tiles ..." % len(paths))

    best = scan(paths, args.tile)

    missing = [i for i, b in enumerate(best) if b is None]
    if missing:
        # Widen the bins rather than invent a tile.
        print("  no window found for bins %s - widening" % missing)
        global BIN_HALFWIDTH
        BIN_HALFWIDTH = 0.09
        retry = scan(paths, args.tile)
        for i in missing:
            best[i] = retry[i]

    still = [i for i, b in enumerate(best) if b is None]
    if still:
        raise SystemExit(
            "bins %s have no matching passage in the corpus. Rather than "
            "synthesise a tile, adjust TONE_TARGETS to what the book contains."
            % still
        )

    tiles = [make_tileable(b["_img"]) for b in best]
    strip = np.concatenate(tiles, axis=1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT_DIR / "tam.png"), strip)

    record = {
        "generated": date.today().isoformat(),
        "generator": "tools/build_hatch_tam.py",
        "what": "Tonal art map for the world's hatching shader. Six tiles, light "
                "to dark, each the most orientation-coherent passage of burin "
                "work found anywhere in the 51 plates at that ink density.",
        "method": "Otsu ink fraction per 256 px window for tone; structure-tensor "
                  "coherence for stroke purity; offset-and-cross-fade for "
                  "tileability (preserves stroke direction, a mirror would not).",
        "strip": {"file": "hatch/tam.png", "tiles": len(tiles),
                  "tile_px": args.tile, "order": "light to dark"},
        "tiles": [{k: v for k, v in b.items() if k != "_img"} for b in best],
    }
    (OUT_DIR / "tam.json").write_text(
        json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")

    print("wrote %s  (%d x %d)" % (OUT_DIR / "tam.png", strip.shape[1], strip.shape[0]))
    for b in best:
        print("  bin %d  tone %.3f (target %.2f)  coherence %.3f  %s %s"
              % (b["bin"], b["tone_measured"], b["tone_target"], b["coherence"],
                 b["plate"], b["window_px"]))


if __name__ == "__main__":
    main()

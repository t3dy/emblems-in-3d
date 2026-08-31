#!/usr/bin/env python
"""
render_solve_overlay.py — draw each plate's recovered perspective back onto it.

This is the review artifact for stage 1. An automated vanishing-point solve is a
claim about the picture, and the only way to judge it is to see the horizon and
the inlier segments drawn over the engraving that produced them. These images are
what the local review app shows for accept / reject / notes, and what the static
site publishes.

Draws:
  cyan     inlier segments for the primary vanishing point
  orange   inlier segments for the secondary vanishing point (two-point plates)
  yellow   the horizon line
  yellow O the vanishing point(s), when they land inside the frame
  green    ground-contact ticks for every `standing` element (from elements.json)

Usage:  python tools/render_solve_overlay.py
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import solve_perspective as sp   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "assets" / "solve"
PERSP = ROOT / "data" / "perspective.json"
ELEMS = ROOT / "data" / "elements.json"

MAXW = 1100


def draw(key, plate_path, rec, elements):
    img = cv2.imread(str(plate_path), cv2.IMREAD_COLOR)
    if img is None:
        return False
    H, W = img.shape[:2]

    # re-run the solve for its inlier segments (cheap, and keeps the picture
    # honest: these are the exact segments that produced the recorded numbers)
    _, dbg = sp.solve(plate_path, debug=True)
    over = img.copy()

    colours = [(255, 220, 40), (40, 160, 255)]   # BGR: cyan-ish, orange
    # On a hand-reviewed plate the automatic inliers are the evidence for an
    # answer that was SUPERSEDED, so drawing them as if they supported the
    # recorded horizon would misrepresent the review. Draw them faintly and say so.
    reviewed = bool(rec.get("reviewed"))
    if dbg and not reviewed:
        for ci, c in enumerate(dbg["candidates"][:2]):
            col = colours[ci % 2]
            for idx in c.get("inlier_idx", []):
                p0, p1 = dbg["segments"][idx][0], dbg["segments"][idx][1]
                cv2.line(over, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])), col, 2)
    img = cv2.addWeighted(over, 0.55, img, 0.45, 0)
    if reviewed:
        cv2.putText(img, "hand-reviewed: horizon placed by measurement, not by the line solver",
                    (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (120, 255, 180), 2, cv2.LINE_AA)

    hy = rec.get("horizon_y")
    tilt = rec.get("horizon_tilt_deg", 0.0) or 0.0
    if hy is not None:
        dy = np.tan(np.radians(tilt)) * (W / 2.0)
        p_l = (0, int(hy - dy)), (W, int(hy + dy))
        cv2.line(img, p_l[0], p_l[1], (0, 235, 255), 3)
        cv2.putText(img, "horizon", (12, max(22, int(hy) - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 235, 255), 2, cv2.LINE_AA)

    for v in rec.get("vps", [])[:2]:
        x, y = int(v["x"]), int(v["y"])
        if -W < x < 2 * W and -H < y < 2 * H:
            cv2.circle(img, (x, y), 14, (0, 235, 255), 3)
            cv2.drawMarker(img, (x, y), (0, 235, 255), cv2.MARKER_CROSS, 34, 2)

    for e in elements:
        if e.get("kind") != "standing":
            continue
        cx, cy = int(e["contact_x"]), int(e["contact_y"])
        good = e.get("contact_confidence", 0) >= 0.6
        col = (80, 235, 80) if good else (80, 200, 235)
        cv2.line(img, (cx - 26, cy), (cx + 26, cy), col, 3)
        cv2.line(img, (cx, cy - 9), (cx, cy + 9), col, 3)
        cv2.putText(img, e["label"][:22], (cx - 24, cy + 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, col, 2, cv2.LINE_AA)

    banner = (f"{key}  {rec['type']}  horizon_y={rec['horizon_y']}  "
              f"f={rec['focal_px']}px ({'assumed' if str(rec.get('focal_basis','')).startswith('ASSUMED') else 'measured'})  "
              f"conf={rec['confidence']}{'  REVIEWED' if rec.get('reviewed') else ''}")
    cv2.rectangle(img, (0, H - 46), (W, H), (24, 20, 16), -1)
    cv2.putText(img, banner, (14, H - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.72,
                (235, 230, 215), 2, cv2.LINE_AA)

    if W > MAXW:
        s = MAXW / W
        img = cv2.resize(img, (MAXW, int(H * s)), interpolation=cv2.INTER_AREA)
    OUT.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT / f"{key}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 84])
    return True


def main():
    persp = json.loads(PERSP.read_text(encoding="utf-8"))
    elems = json.loads(ELEMS.read_text(encoding="utf-8")) if ELEMS.exists() else {}
    n = 0
    for key, rec in sorted(persp.items()):
        p = sp.PLATES / f"{key}.jpg"
        if not p.exists():
            continue
        if draw(key, p, rec, elems.get(key, {}).get("elements", [])):
            n += 1
            print(f"  {key}")
    print(f"{n} overlays -> {OUT}")


if __name__ == "__main__":
    main()

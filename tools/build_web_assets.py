#!/usr/bin/env python
"""
build_web_assets.py — stage 3 of the "plate -> space" pipeline.

Two jobs:

1. **Self-contained plates.** Downscale the 51 Claudiens plates into
   site/assets/plates/. The old site loaded them by absolute path from a server
   rooted at C:/Dev, which is why it could never be published anywhere. These are
   the backdrops too: complete, un-holed, with no binding, gutter or letterpress
   anywhere in them. That single substitution fixes the black void in Emblem VIII
   and the page-furniture problem in one move, because the extraction masks were
   always cut from THESE images (summary.json's `source_image`).

2. **Rectified ground.** For every plate with a usable perspective solve, warp the
   region below the horizon into a top-down view of its own ground plane. This is
   the payoff of the solve: the courtyard pavement Merian ruled in 1617 comes back
   out as a texture you can lay on a real ground plane and walk across.

   The mapping is the plain pinhole. For a ground point (X, Z) with the camera at
   height E looking horizontally:
        u = cx + f * X / Z
        v = y_horizon + f * E / Z
   so the inverse, which is what the remap needs, is
        Z = f * E / (v - y_horizon)      X = (u - cx) * Z / f
   The near limit is the bottom of the plate; the far limit is wherever the ground
   stops being visible (a wall base, a waterline), taken from the solve record's
   `ground_far_ny` or defaulted to just above the horizon.

Usage:  python tools/build_web_assets.py
"""
import json
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PLATES_SRC = Path(r"C:\Dev\EmblemPrintShop\sources\claudiens\site\images\emblems")
SITE = ROOT / "site" / "assets"
OUT_PLATES = SITE / "plates"
OUT_GROUND = SITE / "ground"
PERSP = ROOT / "data" / "perspective.json"

PLATE_W = 1200
PLATE_Q = 82
GROUND_PX = 900
MIN_CONF_FOR_GROUND = 0.45


def make_plate(src, dst):
    img = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if img is None:
        return None
    H, W = img.shape[:2]
    s = PLATE_W / W
    small = cv2.resize(img, (PLATE_W, max(1, int(round(H * s)))), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(dst), small, [cv2.IMWRITE_JPEG_QUALITY, PLATE_Q])
    return (W, H, small.shape[1], small.shape[0])


def rectify_ground(src, rec, dst):
    """Top-down texture of the plate's own ground plane. Returns its extent in metres."""
    img = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if img is None:
        return None
    H, W = img.shape[:2]
    f = float(rec["focal_px"])
    E = float(rec.get("eye_height_m") or 1.6)
    yh = float(rec["horizon_y"])
    cx = W / 2.0

    if yh >= H - 40:
        return None                        # horizon at or below the plate: no ground

    # depth range: near = bottom edge of the plate, far = where the ground stops
    far_ny = rec.get("ground_far_ny")
    y_far = float(far_ny) * H if far_ny else yh + max(24.0, 0.06 * (H - yh))
    if y_far <= yh + 8:
        return None
    z_near = f * E / (H - yh)
    z_far = f * E / (y_far - yh)
    if not (0.2 < z_near < z_far < 400):
        return None

    # lateral extent: as wide as the plate is at the far edge, so nothing is invented
    x_half = (W / 2.0) * z_far / f

    zs = np.linspace(z_far, z_near, GROUND_PX)            # row 0 = far
    xs = np.linspace(-x_half, x_half, GROUND_PX)
    Z = np.repeat(zs[:, None], GROUND_PX, axis=1)
    X = np.repeat(xs[None, :], GROUND_PX, axis=0)
    map_u = (cx + f * X / Z).astype(np.float32)
    map_v = (yh + f * E / Z).astype(np.float32)
    g = cv2.remap(img, map_u, map_v, cv2.INTER_LINEAR,
                  borderMode=cv2.BORDER_CONSTANT, borderValue=(226, 219, 202))
    # samples that fell outside the plate are not evidence; blank them to paper
    bad = (map_u < 0) | (map_u > W - 1) | (map_v < 0) | (map_v > H - 1)
    g[bad] = (202, 219, 226)[::-1]
    cv2.imwrite(str(dst), g, [cv2.IMWRITE_JPEG_QUALITY, 86])
    return {"z_near_m": round(float(z_near), 3), "z_far_m": round(float(z_far), 3),
            "x_half_m": round(float(x_half), 3),
            "coverage": round(float(1.0 - bad.mean()), 3)}


def main():
    persp = json.loads(PERSP.read_text(encoding="utf-8"))
    OUT_PLATES.mkdir(parents=True, exist_ok=True)
    OUT_GROUND.mkdir(parents=True, exist_ok=True)

    manifest = {}
    n_ground = 0
    for key in sorted(persp):
        src = PLATES_SRC / f"{key}.jpg"
        if not src.exists():
            continue
        rec = persp[key]
        dims = make_plate(src, OUT_PLATES / f"{key}.jpg")
        entry = {"plate": f"plates/{key}.jpg",
                 "src_w": dims[0], "src_h": dims[1],
                 "web_w": dims[2], "web_h": dims[3]}

        usable = rec.get("reviewed") or rec.get("confidence", 0) >= MIN_CONF_FOR_GROUND
        if usable and rec.get("horizon_y") is not None:
            g = rectify_ground(src, rec, OUT_GROUND / f"{key}.jpg")
            if g and g["coverage"] > 0.25:
                entry["ground"] = dict(g, file=f"ground/{key}.jpg")
                n_ground += 1
            elif g:
                (OUT_GROUND / f"{key}.jpg").unlink(missing_ok=True)
                entry["ground_rejected"] = f"coverage {g['coverage']} below 0.25"
        manifest[key] = entry
        tag = "  + ground" if "ground" in entry else ""
        print(f"  {key}  {dims[2]}x{dims[3]}{tag}")

    (SITE / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"\n{len(manifest)} plates | {n_ground} rectified grounds")
    print(f"-> {OUT_PLATES}\n-> {OUT_GROUND}\n-> {SITE / 'manifest.json'}")


if __name__ == "__main__":
    main()

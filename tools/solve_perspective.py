#!/usr/bin/env python
"""
solve_perspective.py — recover each Atalanta plate's perspective construction.

Stage 1 of the "plate -> space" pipeline (REVISIONPROPOSAL.md sec. 3). The
engravings are ruled constructions: Merian worked from a horizon and one or two
vanishing points, and the paving grids, wall courses and cornices are still in
the picture. This reads them back out.

Method
  Canny -> HoughLinesP -> keep segments that are neither near-horizontal nor
  near-vertical (those are picture-plane-parallel edges and verticals; only the
  OBLIQUE segments are orthogonals receding to a vanishing point) -> RANSAC over
  pairwise intersections, scoring a candidate point by how many segments' infinite
  lines pass close to it, weighted by segment length.

  Left-leaning and right-leaning segments are solved separately. One strong
  cluster => one-point perspective, horizon is horizontal through it. Two strong
  clusters => two-point, horizon is the line through both, and the focal length
  follows from the orthogonality constraint
        f^2 = -(v1 - c) . (v2 - c)
  with c the principal point (assumed at image centre).

  With no second vanishing point f cannot be recovered from one image, so it is
  assumed (FOV_ASSUMED_DEG) and the record says so.

Output: data/perspective.json — one record per plate. Everything the solver
guessed carries a confidence and a `basis` string; nothing is presented as
measured when it was assumed. Manual review overrides live in
data/perspective.overrides.json and always win.

Usage:  python tools/solve_perspective.py
"""
import json
import math
import os
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PLATES = Path(r"C:\Dev\EmblemPrintShop\sources\claudiens\site\images\emblems")
OUT = ROOT / "data" / "perspective.json"
OVERRIDES = ROOT / "data" / "perspective.overrides.json"

FOV_ASSUMED_DEG = 46.0     # assumed horizontal FOV when only one VP is available
MIN_SEG_FRAC = 0.070       # segment must be at least this fraction of image width
OBLIQUE_MIN_DEG = 4.0      # below this a segment is "horizontal" (picture-parallel)
OBLIQUE_MAX_DEG = 62.0     # above this it is "vertical"
RANSAC_ITERS = 4000
MAX_SEGS = 400             # longest N oblique segments per plate
HORIZON_BAND = (0.12, 0.88)  # plausible vertical band for a vanishing point
INLIER_TOL_FRAC = 0.012    # point-to-line distance tolerance, fraction of width
RNG = np.random.default_rng(20260831)   # fixed: solves must be reproducible


# ---------------------------------------------------------------------------
# line extraction
# ---------------------------------------------------------------------------
def segments(gray, W, H):
    """Oblique line segments, as (p0, p1, length, homogeneous line)."""
    # the plates are laid paper: a mild blur kills the hatching texture that
    # otherwise dominates the edge map, leaving the ruled construction lines
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 40, 130, apertureSize=3)
    minlen = int(MIN_SEG_FRAC * W)
    raw = cv2.HoughLinesP(edges, 1, np.pi / 720, threshold=60,
                          minLineLength=minlen, maxLineGap=6)
    out = []
    if raw is None:
        return out
    for x1, y1, x2, y2 in raw[:, 0, :]:
        dx, dy = float(x2 - x1), float(y2 - y1)
        L = math.hypot(dx, dy)
        if L < minlen:
            continue
        ang = abs(math.degrees(math.atan2(dy, dx)))
        ang = min(ang, 180.0 - ang)          # fold to 0..90
        if ang < OBLIQUE_MIN_DEG or ang > OBLIQUE_MAX_DEG:
            continue                          # picture-parallel or vertical
        p0 = np.array([x1, y1, 1.0])
        p1 = np.array([x2, y2, 1.0])
        line = np.cross(p0, p1)
        n = math.hypot(line[0], line[1])
        if n < 1e-9:
            continue
        out.append((p0, p1, L, line / n))
    # keep only the longest segments: the ruled construction lines are long,
    # the hatching noise is short, and this bounds the RANSAC cost
    out.sort(key=lambda s: -s[2])
    return out[:MAX_SEGS]


def pack(segs):
    """Vectorised view of a segment list: (lines Nx3, lengths N, midpoints Nx2)."""
    lines = np.array([s[3] for s in segs])
    lens = np.array([s[2] for s in segs])
    mids = np.array([((s[0] + s[1]) / 2.0)[:2] for s in segs])
    return lines, lens, mids


def score_point(vh, P, tol):
    """Weighted count of segments whose infinite line passes within tol of vh."""
    lines, lens, mids = P
    d = np.abs(lines @ vh)
    near = d < tol
    if not near.any():
        return 0.0, np.array([], dtype=int)
    # a segment only votes for a point it actually recedes toward: reject
    # points sitting inside the segment's own span
    off = mids - vh[:2]
    far_enough = (off[:, 0] ** 2 + off[:, 1] ** 2) >= (lens * 0.35) ** 2
    keep = near & far_enough
    return float(lens[keep].sum()), np.nonzero(keep)[0]


def ransac_vp(segs, W, H):
    """Best vanishing point for a set of segments."""
    if len(segs) < 4:
        return None
    tol = INLIER_TOL_FRAC * W
    P = pack(segs)
    lines = P[0]
    n = len(segs)

    # sample all candidate pairs at once, then score each candidate
    i = RNG.integers(0, n, RANSAC_ITERS)
    j = RNG.integers(0, n, RANSAC_ITERS)
    ok = i != j
    V = np.cross(lines[i[ok]], lines[j[ok]])
    good = np.abs(V[:, 2]) > 1e-9
    V = V[good] / V[good][:, 2:3]
    # reject absurd points (more than 30 image widths away): those are
    # numerically parallel lines, not a real convergence
    V = V[(np.abs(V[:, 0]) < 30 * W) & (np.abs(V[:, 1]) < 30 * H)]
    # Prior: in this corpus the horizon is inside the picture. Merian frames
    # every plate so that the ground meets the sky within the plate border, so a
    # candidate whose y falls outside the middle band is hatching noise, not a
    # construction. This prior is what makes the solve usable at all on densely
    # hatched engravings; it is recorded in the output as HORIZON_BAND.
    V = V[(V[:, 1] > HORIZON_BAND[0] * H) & (V[:, 1] < HORIZON_BAND[1] * H)]

    best = (0.0, None, np.array([], dtype=int))
    for vh in V:
        s, inl = score_point(vh, P, tol)
        if s > best[0]:
            best = (s, vh, inl)
    if best[1] is None:
        return None
    # least-squares refit on the inliers
    inl = best[2]
    if len(inl) >= 2:
        _, _, Vt = np.linalg.svd(lines[inl])
        v = Vt[-1]
        if abs(v[2]) > 1e-12:
            vh = v / v[2]
            s2, inl2 = score_point(vh, P, tol)
            if s2 >= best[0] * 0.9:
                best = (s2, vh, inl2)
    return {"v": best[1], "weight": best[0], "inliers": int(len(best[2])),
            "inlier_idx": best[2]}


def split_lean(segs):
    """Separate left-leaning from right-leaning segments."""
    left, right = [], []
    for s in segs:
        p0, p1 = s[0], s[1]
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        if dx == 0:
            continue
        (right if (dy / dx) > 0 else left).append(s)
    return left, right


# ---------------------------------------------------------------------------
# solve one plate
# ---------------------------------------------------------------------------
def solve(path, debug=False):
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return (None, None) if debug else None
    H, W = img.shape[:2]
    cx, cy = W / 2.0, H / 2.0
    segs = segments(img, W, H)
    left, right = split_lean(segs)
    a = ransac_vp(left, W, H)
    b = ransac_vp(right, W, H)

    rec = {
        "width": W, "height": H,
        "segments_considered": len(segs),
        "vps": [], "type": None, "horizon_y": None,
        "focal_px": None, "focal_basis": None,
        "confidence": 0.0, "reviewed": False,
        "notes": "",
    }

    cand = [c for c in (a, b) if c is not None]
    cand.sort(key=lambda c: -c["weight"])
    for c in cand:
        rec["vps"].append({"x": round(float(c["v"][0]), 1),
                           "y": round(float(c["v"][1]), 1),
                           "inliers": c["inliers"],
                           "weight": round(float(c["weight"]), 1)})

    total_len = sum(s[2] for s in segs) or 1.0

    # --- two-point: both clusters strong and on opposite sides of the frame ---
    if len(cand) == 2:
        v1, v2 = cand[0]["v"], cand[1]["v"]
        opposite = (v1[0] - cx) * (v2[0] - cx) < 0
        both_strong = min(cand[0]["weight"], cand[1]["weight"]) > 0.10 * total_len
        if opposite and both_strong:
            d = -((v1[0] - cx) * (v2[0] - cx) + (v1[1] - cy) * (v2[1] - cy))
            if d > 0:
                rec["type"] = "two-point"
                rec["focal_px"] = round(float(math.sqrt(d)), 1)
                rec["focal_basis"] = "orthogonality of two vanishing points"
                # horizon = line through both VPs, reported as its y at image centre
                t = (cx - v1[0]) / (v2[0] - v1[0]) if abs(v2[0] - v1[0]) > 1e-6 else 0.5
                rec["horizon_y"] = round(float(v1[1] + t * (v2[1] - v1[1])), 1)
                rec["horizon_tilt_deg"] = round(math.degrees(math.atan2(
                    v2[1] - v1[1], v2[0] - v1[0])), 2)
                rec["confidence"] = round(min(1.0, (cand[0]["weight"] + cand[1]["weight"])
                                              / total_len), 3)

    # --- one-point fallback: strongest cluster, horizontal horizon through it ---
    if rec["type"] is None and cand:
        c = cand[0]
        rec["type"] = "one-point"
        rec["horizon_y"] = round(float(c["v"][1]), 1)
        rec["horizon_tilt_deg"] = 0.0
        rec["focal_px"] = round(float((W / 2.0) / math.tan(math.radians(FOV_ASSUMED_DEG / 2))), 1)
        rec["focal_basis"] = f"ASSUMED {FOV_ASSUMED_DEG} deg horizontal FOV (one VP only)"
        rec["confidence"] = round(min(1.0, c["weight"] / total_len), 3)

    if rec["type"] is None:
        rec["type"] = "unsolved"
        rec["focal_px"] = round(float((W / 2.0) / math.tan(math.radians(FOV_ASSUMED_DEG / 2))), 1)
        rec["focal_basis"] = f"ASSUMED {FOV_ASSUMED_DEG} deg horizontal FOV (no VP found)"
        rec["horizon_y"] = round(H * 0.5, 1)
        rec["notes"] = ("no vanishing point recovered; horizon defaulted to mid-frame. "
                        "Needs manual review before use.")

    # defaults every record carries so downstream code never has to guess.
    # A reconstruction needs an eye height as well as a horizon: the horizon
    # gives the DIRECTION of the ground plane, the eye height gives its SCALE.
    # Only a hand review can measure it (it needs a figure of known height), so
    # the automatic path assumes and says so.
    rec["horizon_ny"] = round(rec["horizon_y"] / H, 5) if rec["horizon_y"] is not None else None
    rec["eye_height_m"] = 1.6
    rec["eye_height_basis"] = ("ASSUMED standing adult viewer; not measured. "
                               "Needs a hand review against a figure in the plate.")

    # a horizon far outside the frame is a solver failure, not a wide vista
    if rec["horizon_y"] is not None and not (-0.5 * H < rec["horizon_y"] < 1.5 * H):
        rec["confidence"] = 0.0
        rec["notes"] = (rec["notes"] + " horizon fell outside plausible range; "
                        "treat as unsolved.").strip()
    if debug:
        return rec, {"segments": segs, "candidates": cand}
    return rec


def main():
    plates = sorted(PLATES.glob("emblem-*.jpg"))
    overrides = {}
    if OVERRIDES.exists():
        overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))

    out = {}
    for p in plates:
        key = p.stem                      # emblem-08
        rec = solve(p)
        if rec is None:
            continue
        if key in overrides:
            rec["auto"] = {k: rec.get(k) for k in
                           ("type", "horizon_y", "horizon_ny", "focal_px", "confidence")}
            rec.update(overrides[key])
            rec["reviewed"] = True
            if rec.get("horizon_y") is not None:
                rec["horizon_ny"] = round(rec["horizon_y"] / rec["height"], 5)
        out[key] = rec
        flag = "  <-- REVIEWED" if rec.get("reviewed") else ""
        print(f"{key}: {rec['type']:>9}  horizon_y={rec['horizon_y']}  "
              f"f={rec['focal_px']}  conf={rec['confidence']}  "
              f"segs={rec['segments_considered']}{flag}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")

    solved = [r for r in out.values() if r["type"] != "unsolved"]
    good = [r for r in out.values() if r["confidence"] >= 0.25]
    print(f"\n{len(out)} plates | {len(solved)} with a VP | "
          f"{len(good)} at confidence >= 0.25 | "
          f"{sum(1 for r in out.values() if r.get('reviewed'))} hand-reviewed")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()

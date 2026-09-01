#!/usr/bin/env python
"""
classify_armature.py — decide what kind of question each plate can answer,
BEFORE trying to answer it.

The measured problem (PROPOSAL_PHASE6.md sec.1): the vanishing-point solver is
confidently wrong on two thirds of the corpus, and better line detection makes it
worse, not better. Emblem XXI's wall is frontoparallel — it has no vanishing point,
which is exactly why its great circle reads as a true circle. Emblem I is a
landscape with no architecture. The solver was answering a question those plates
do not pose.

So: classify first, estimate second, and let a plate return "no horizon
recoverable" instead of a number.

Three measurements per plate, all from the same segment set:

  stability       THE EXISTENCE TEST. Solve the vanishing point independently at
                  1/6, 1/4 and 1/3 scale and measure how far the three answers sit
                  apart. A real ruled construction is scale-invariant: its lines are
                  long and survive every scale, so the three solves agree. Hatching
                  noise does not survive -- which "vanishing point" it produces
                  depends on which frequency band you happen to look at, so the
                  answers jump. Measured spread, normalised by plate size:

                      emblem-45  0.006   a real construction, and it is
                      emblem-01  0.125   landscape; no construction
                      emblem-08  0.284   construction present but half-occluded by
                                         the figure. The 1/4-scale solve is correct
                                         to 0.014, but the other scales disagree, so
                                         the automatic test rightly declines to
                                         confirm it and hand review carries it.
                      emblem-21  0.358   frontoparallel wall: nothing to converge
                      emblem-05  0.456   figures and drapery only

  oblique_energy  share of segment length that is neither horizontal nor vertical.
                  Low means the picture is built parallel to the picture plane.
  horizon_band    strongest long horizontal edge. In a landscape this is the
                  waterline; a candidate for review, never an answer.

    stability < STABLE_MAX   -> ruled      a construction is there; trust the VP
    stability < SHAKY_MAX    -> uncertain  something is there; a person must look
    otherwise                -> open       no construction recoverable from lines

Usage:  python tools/classify_armature.py [--apply]
        --apply writes the class and the verdict into data/perspective.json
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import solve_perspective as sp   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PERSP = ROOT / "data" / "perspective.json"

FRONTAL_MAX = 0.30      # below this share of oblique ink, the picture is frontal
STABLE_MAX = 0.05       # scale-spread below this: a construction is really there
SHAKY_MAX = 0.15        # between: something is there, but a person has to look
SCALES = (1 / 6, 1 / 4, 1 / 3)
COARSE = 0.25           # reporting scale for segment statistics

HELP = {
    "ruled": "a ruled perspective construction, confirmed by three independent "
             "scale solves agreeing. The vanishing point is meaningful and depth "
             "follows from it.",
    "uncertain": "there is probably a construction here, but the scales do not agree "
                 "well enough to trust it unattended. Usually means the architecture "
                 "is partly occluded by figures. Needs a person.",
    "frontal": "built from horizontals and verticals parallel to the picture plane. "
               "There is no vanishing point to find, and that is a fact about the "
               "picture rather than a failure of the solver. Horizon must come from "
               "a figure of known height, or by hand.",
    "open": "no perspective construction recoverable from line convergence: foliage, "
            "terrain, drapery and figures, which is most of this book. Horizon from "
            "the ground/water boundary or from a figure of known height.",
}


def all_segments(gray, W, H, min_frac=0.05):
    """Every long segment, unfiltered by angle, at the coarse scale."""
    small = cv2.resize(gray, (max(8, int(W * COARSE)), max(8, int(H * COARSE))),
                       interpolation=cv2.INTER_AREA)
    h, w = small.shape[:2]
    edges = cv2.Canny(cv2.GaussianBlur(small, (3, 3), 0), 40, 130)
    minlen = max(8, int(min_frac * w))
    raw = cv2.HoughLinesP(edges, 1, np.pi / 720, threshold=40,
                          minLineLength=minlen, maxLineGap=4)
    out = []
    if raw is None:
        return out
    for x1, y1, x2, y2 in raw[:, 0, :]:
        dx, dy = float(x2 - x1), float(y2 - y1)
        L = math.hypot(dx, dy)
        ang = abs(math.degrees(math.atan2(dy, dx)))
        ang = min(ang, 180.0 - ang)
        # lift back to full-plate pixels so everything downstream shares one frame
        p0 = np.array([x1 / COARSE, y1 / COARSE, 1.0])
        p1 = np.array([x2 / COARSE, y2 / COARSE, 1.0])
        line = np.cross(p0, p1)
        n = math.hypot(line[0], line[1])
        if n < 1e-9:
            continue
        out.append((p0, p1, L / COARSE, line / n, ang))
    return out


def horizon_band(gray, W, H):
    """Strongest long horizontal edge: the waterline of last resort."""
    small = cv2.resize(gray, (int(W * COARSE), int(H * COARSE)), interpolation=cv2.INTER_AREA)
    gy = cv2.Sobel(small.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
    rows = np.abs(gy).mean(axis=1)
    rows = cv2.GaussianBlur(rows.reshape(-1, 1), (1, 9), 0).ravel()
    # ignore the outer eighth: plate borders are the strongest horizontal in every scan
    lo, hi = int(0.12 * len(rows)), int(0.88 * len(rows))
    band = rows[lo:hi]
    if len(band) == 0:
        return None, 0.0
    i = int(np.argmax(band)) + lo
    strength = float(band.max() / (rows.mean() + 1e-6))
    return i / len(rows), strength


def vp_at_scale(gray, W0, H0, s):
    """Best vanishing point from the plate viewed at scale s, in full-plate pixels."""
    small = cv2.resize(gray, (max(16, int(W0 * s)), max(16, int(H0 * s))),
                       interpolation=cv2.INTER_AREA)
    h, w = small.shape[:2]
    lifted = []
    for p0, p1, L, _ in sp.segments(small, w, h):
        q0 = np.array([p0[0] / s, p0[1] / s, 1.0])
        q1 = np.array([p1[0] / s, p1[1] / s, 1.0])
        line = np.cross(q0, q1)
        n = math.hypot(line[0], line[1])
        if n > 1e-9:
            lifted.append((q0, q1, L / s, line / n))
    if len(lifted) < 6:
        return None
    left, right = sp.split_lean(lifted)
    cands = [c for c in (sp.ransac_vp(left, W0, H0), sp.ransac_vp(right, W0, H0)) if c]
    if not cands:
        return None
    return max(cands, key=lambda c: c["weight"])["v"]


def classify(path):
    gray = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    H, W = gray.shape[:2]

    segs = all_segments(gray, W, H)
    total = sum(s[2] for s in segs) or 1.0
    obl = [s for s in segs if sp.OBLIQUE_MIN_DEG < s[4] < sp.OBLIQUE_MAX_DEG]
    oblique_energy = sum(s[2] for s in obl) / total

    # ---- the existence test ------------------------------------------------
    vps = [v for v in (vp_at_scale(gray, W, H, sc) for sc in SCALES) if v is not None]
    if len(vps) >= 2:
        xs = np.array([v[0] / W for v in vps])
        ys = np.array([v[1] / H for v in vps])
        stability = float(np.hypot(xs.std(), ys.std()))
        med = [float(np.median(xs) * W), float(np.median(ys) * H)]
        scale_ny = [round(float(y), 3) for y in ys]
    else:
        stability, med, scale_ny = None, None, []

    hb_ny, hb_strength = horizon_band(gray, W, H)

    if stability is None:
        cls = "open"
    elif stability < STABLE_MAX:
        cls = "ruled"
    elif oblique_energy < FRONTAL_MAX:
        cls = "frontal"
    elif stability < SHAKY_MAX:
        cls = "uncertain"
    else:
        cls = "open"

    return {
        "armature_class": cls,
        "stability": round(stability, 4) if stability is not None else None,
        "scale_vps_ny": scale_ny,
        "oblique_energy": round(float(oblique_energy), 3),
        "coarse_vp": [round(med[0], 1), round(med[1], 1)] if med else None,
        "horizon_band_ny": round(float(hb_ny), 3) if hb_ny is not None else None,
        "horizon_band_strength": round(float(hb_strength), 2),
        "segments": len(segs),
        "class_meaning": HELP[cls],
    }


def main():
    apply = "--apply" in sys.argv
    persp = json.loads(PERSP.read_text(encoding="utf-8"))
    counts = {"ruled": 0, "uncertain": 0, "frontal": 0, "open": 0}
    changed = 0

    for key in sorted(persp):
        p = sp.PLATES / f"{key}.jpg"
        if not p.exists():
            continue
        c = classify(p)
        counts[c["armature_class"]] = counts.get(c["armature_class"], 0) + 1
        rec = persp[key]
        reviewed = bool(rec.get("reviewed"))

        if apply:
            rec.update(c)
            if not reviewed:
                if c["armature_class"] == "ruled":
                    rec["horizon_recoverable"] = True
                    if c.get("coarse_vp"):
                        # the coarse-scale solve, which measured 0.014 error against
                        # the hand measurement on Emblem VIII where the old full-scale
                        # solve measured 0.181
                        rec["horizon_y"] = c["coarse_vp"][1]
                        rec["horizon_ny"] = round(c["coarse_vp"][1] / rec["height"], 5)
                        rec["horizon_basis"] = (
                            f"multi-scale vanishing point, confirmed by three "
                            f"independent solves agreeing to {c['stability']} of "
                            f"plate size (threshold {STABLE_MAX}). Hatching is "
                            f"suppressed by scale, not by filtering.")
                        rec["confidence"] = round(
                            max(0.4, 1.0 - c["stability"] / STABLE_MAX * 0.5), 3)
                        rec["vps"] = [{"x": c["coarse_vp"][0], "y": c["coarse_vp"][1]}]
                        changed += 1
                else:
                    # This is the point of the whole exercise: say nothing rather than
                    # say something wrong. A frontal or open plate has no vanishing
                    # point to recover, so the record carries no horizon and the site
                    # shows it as needing a person.
                    rec["horizon_recoverable"] = False
                    rec["horizon_y"] = None
                    rec["horizon_ny"] = None
                    rec["vps"] = []
                    rec["confidence"] = 0.0
                    rec["horizon_basis"] = (
                        f"NOT RECOVERABLE from line convergence: {c['class_meaning']} "
                        f"(scale spread {c['stability']}, oblique energy {c['oblique_energy']}). "
                        f"Nearest strong horizontal edge is at ny {c['horizon_band_ny']} "
                        f"— a candidate for review, not an answer.")
                    rec["horizon_candidate_ny"] = c["horizon_band_ny"]
                    changed += 1
            else:
                rec["horizon_recoverable"] = True

        flag = " REVIEWED" if reviewed else ""
        st = f"{c['stability']:.3f}" if c["stability"] is not None else "  -  "
        print(f"{key}: {c['armature_class']:>9}  spread {st}  "
              f"oblique {c['oblique_energy']:.2f}  band ny {c['horizon_band_ny']}{flag}")

    print(f"\n{counts}   ({changed} records rewritten)" if apply else f"\n{counts}")
    if apply:
        PERSP.write_text(json.dumps(persp, indent=1), encoding="utf-8")
        print(f"-> {PERSP}")


if __name__ == "__main__":
    main()

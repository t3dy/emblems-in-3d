#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
equal_height_horizon.py - recover the horizon from the people in the picture.

PROPOSAL_PHASE6.md sec. 1 named this as the estimator the landscape and wall
plates actually need, and then noted it was unusable because the extraction
pipeline finds five figures across fifty-one plates. This module makes it
usable the other way round: a person marks the figures, and the construction
does the rest.

THE CONSTRUCTION (Criminisi, Reid & Zisserman, *Single View Metrology*, IJCV
2000). For two objects of the SAME height standing on ONE ground plane, the
line through their tops and the line through their bases meet at a point, and
that point lies on the horizon. Two such pairs give the horizon line outright.

The strength of it, and the reason it suits this corpus, is that it needs no
architecture, no vanishing point, and no assumption about how tall anyone is.
It needs only that the figures be about the same height and standing on the
same ground - which is true of Merian's staffage almost everywhere the
architecture fails.

    head_i --------____
                        ----____
    head_j ------------------------o  <- on the horizon
                        ____----
    foot_j ------____----
    foot_i

With n marked figures there are n(n-1)/2 pairs and so n(n-1)/2 points on the
horizon. With three or more figures the horizon is over-determined, we fit it
by total least squares, and the residuals are the honest error report: if the
points do not lie on a line, the figures are NOT the same height or NOT on one
plane, and the plate is telling us so.

Input: data/figures.json

    {
      "emblem-42": {
        "figures": [
          {"name": "Nature",   "head": [0.195, 0.145], "foot": [0.175, 0.948]},
          {"name": "the adept","head": [0.775, 0.215], "foot": [0.762, 0.815]}
        ],
        "marked_by": "who marked them",
        "verified": false,
        "note": "free text"
      }
    }

Coordinates are normalised: x fraction of plate width, y fraction of height,
origin top-left, which is the convention the rest of the pipeline uses.

Usage:
    python tools/equal_height_horizon.py               # report only
    python tools/equal_height_horizon.py --write       # write the overrides too
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIGURES = ROOT / "data" / "figures.json"
PERSP = ROOT / "data" / "perspective.json"
OVERRIDES = ROOT / "data" / "perspective.overrides.json"

# An eye is not on top of a head. For a standing adult the eye sits at about
# 0.93 of stature; the horizon cuts an upright figure at exactly eye height, so
# the fraction of a figure's drawn height at which the horizon crosses it gives
# the station point's height as a fraction of that figure's height.
EYE_FRACTION_OF_STATURE = 0.93
ASSUMED_STATURE_M = 1.70


def _line(p, q):
    """Homogeneous line through two points."""
    return (
        p[1] * q[2] - p[2] * q[1],
        p[2] * q[0] - p[0] * q[2],
        p[0] * q[1] - p[1] * q[0],
    )


def _h(p):
    return (p[0], p[1], 1.0)


def _meet(l1, l2):
    """Intersection of two homogeneous lines, or None if parallel."""
    x = l1[1] * l2[2] - l1[2] * l2[1]
    y = l1[2] * l2[0] - l1[0] * l2[2]
    w = l1[0] * l2[1] - l1[1] * l2[0]
    if abs(w) < 1e-12:
        return None
    return (x / w, y / w)


def horizon_points(figures):
    """One point on the horizon per pair of figures."""
    pts = []
    for i in range(len(figures)):
        for j in range(i + 1, len(figures)):
            a, b = figures[i], figures[j]
            tops = _line(_h(a["head"]), _h(b["head"]))
            bases = _line(_h(a["foot"]), _h(b["foot"]))
            p = _meet(tops, bases)
            if p is None:
                # The two figures subtend the same height: the meet is at
                # infinity, which says the horizon is PARALLEL to both lines
                # but not where it is. Record it as a direction, not a point.
                pts.append({"pair": [i, j], "at_infinity": True})
            else:
                pts.append({"pair": [i, j], "point": [p[0], p[1]]})
    return pts


def fit_horizon(pts, figures):
    """Total-least-squares line through the pair points, plus residuals.

    With exactly two figures there is one point and no line, so the horizon is
    taken as HORIZONTAL through it — which is the right default for a plate
    whose horizon tilt has not been measured, and is recorded as such.
    """
    finite = [p for p in pts if "point" in p]
    if not finite:
        return None

    if len(finite) == 1:
        y = finite[0]["point"][1]
        return {
            "horizon_ny": y,
            "tilt_deg": 0.0,
            "basis": "one pair of figures: the horizon passes through their "
                     "single meet, and is ASSUMED level because one point "
                     "cannot give a tilt",
            "residual_ny": None,
            "points": finite,
        }

    xs = [p["point"][0] for p in finite]
    ys = [p["point"][1] for p in finite]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = sxy / sxx if sxx > 1e-12 else 0.0
    intercept = my - slope * mx
    resid = [abs(y - (slope * x + intercept)) for x, y in zip(xs, ys)]

    return {
        # report the horizon at the plate's horizontal centre
        "horizon_ny": slope * 0.5 + intercept,
        "tilt_deg": math.degrees(math.atan(slope)),
        "basis": "%d figures -> %d pair meets, fitted by least squares" % (len(figures), n),
        "residual_ny": max(resid),
        "points": finite,
    }


def eye_height(figures, horizon_ny, plate_h):
    """Where the horizon cuts a figure gives the station point's height."""
    ratios = []
    for f in figures:
        top, base = f["head"][1], f["foot"][1]
        h = base - top
        if h <= 1e-6:
            continue
        ratios.append((base - horizon_ny) / h)
    if not ratios:
        return None
    mean = sum(ratios) / len(ratios)
    spread = max(ratios) - min(ratios)
    return {
        "fraction_of_figure": mean,
        "spread": spread,
        "eye_height_m": mean / EYE_FRACTION_OF_STATURE * ASSUMED_STATURE_M * EYE_FRACTION_OF_STATURE,
        "note": "eye height = (fraction of the figure's height at which the horizon "
                "cuts it) x ASSUMED %.2f m stature. The fraction is measured; the "
                "stature is assumed, and any error in it scales every depth on the "
                "plate by the same factor without changing the geometry."
                % ASSUMED_STATURE_M,
    }


def solve_plate(entry, plate_w, plate_h):
    figs = entry.get("figures") or []
    if len(figs) < 2:
        return {"ok": False, "why": "need at least two marked figures, have %d" % len(figs)}
    pts = horizon_points(figs)
    fit = fit_horizon(pts, figs)
    if not fit:
        return {"ok": False,
                "why": "every pair meets at infinity: the figures are drawn at the "
                       "same size, so they are at the same depth and give no horizon"}
    ny = fit["horizon_ny"]
    if not (0.0 < ny < 1.0):
        return {"ok": False,
                "why": "the construction puts the horizon at ny %.3f, outside the "
                       "plate. The figures are not the same height, or not on one "
                       "ground plane, and the plate is saying so." % ny}
    eh = eye_height(figs, ny, plate_h)
    return {
        "ok": True,
        "horizon_ny": ny,
        "horizon_y": ny * plate_h,
        "tilt_deg": fit["tilt_deg"],
        "residual_ny": fit["residual_ny"],
        "eye": eh,
        "fit_basis": fit["basis"],
        "n_figures": len(figs),
        "figure_names": [f.get("name") or "figure %d" % i for i, f in enumerate(figs)],
    }


def basis_string(res, entry):
    names = ", ".join(res["figure_names"])
    s = ("Equal-height construction (Criminisi, Reid & Zisserman, Single View "
         "Metrology, IJCV 2000) on %d marked standing figures: %s. %s. "
         "The line through the figures' heads and the line through their feet "
         "meet on the horizon; no assumption is made about how tall anyone is."
         % (res["n_figures"], names, res["fit_basis"]))
    if res["residual_ny"] is not None:
        s += (" Largest residual of a pair meet from the fitted line: %.4f of "
              "plate height." % res["residual_ny"])
    if res["eye"]:
        s += (" The horizon cuts the figures at %.3f of their height (spread %.3f "
              "between figures, which is the check that they really are the same "
              "height on one plane)." % (res["eye"]["fraction_of_figure"], res["eye"]["spread"]))
    if not entry.get("verified"):
        s += (" MARKED BUT NOT VERIFIED: the head and foot points were placed by "
              "eye and have not been checked against a grid, so this horizon is a "
              "hand estimate, not a measurement.")
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help="write the results into data/perspective.overrides.json")
    ap.add_argument("--verified-only", action="store_true",
                    help="only write entries a person has marked verified:true")
    args = ap.parse_args()

    if not FIGURES.exists():
        raise SystemExit("no %s — mark some figures in the review app first" % FIGURES)

    figures = json.loads(FIGURES.read_text(encoding="utf-8"))
    persp = json.loads(PERSP.read_text(encoding="utf-8"))
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}

    wrote = 0
    for key, entry in sorted(figures.items()):
        if key.startswith("_"):
            continue
        p = persp.get(key) or {}
        w, h = p.get("width", 1600), p.get("height", 1373)
        res = solve_plate(entry, w, h)
        if not res["ok"]:
            print("%-12s  no solve: %s" % (key, res["why"]))
            continue
        print("%-12s  horizon ny %.4f  tilt %+.2f deg  eye %.2f m  %s"
              % (key, res["horizon_ny"], res["tilt_deg"],
                 (res["eye"] or {}).get("eye_height_m", 0.0),
                 "verified" if entry.get("verified") else "UNVERIFIED"))
        if not args.write:
            continue
        if args.verified_only and not entry.get("verified"):
            print("               (not written: not verified)")
            continue

        o = overrides.setdefault(key, {})
        o["horizon_ny"] = round(res["horizon_ny"], 4)
        o["horizon_y"] = round(res["horizon_y"], 1)
        o["horizon_tilt_deg"] = round(res["tilt_deg"], 3)
        o["horizon_basis"] = basis_string(res, entry)
        o["horizon_method"] = "equal-height"
        o["horizon_verified"] = bool(entry.get("verified"))
        if res["eye"]:
            o["eye_height_m"] = round(res["eye"]["eye_height_m"], 3)
            o["eye_height_basis"] = res["eye"]["note"]
        o["confidence"] = 0.8 if entry.get("verified") else 0.5
        o["_written_by"] = "tools/equal_height_horizon.py on %s" % date.today().isoformat()
        wrote += 1

    if args.write and wrote:
        OVERRIDES.write_text(json.dumps(overrides, indent=1, ensure_ascii=False),
                             encoding="utf-8")
        print("\nwrote %d entries into %s" % (wrote, OVERRIDES.relative_to(ROOT)))
        print("now re-run:  python tools/solve_perspective.py && python tools/build_world.py")


if __name__ == "__main__":
    main()

#!/usr/bin/env python
"""
build_elements.py — stage 2 of the "plate -> space" pipeline.

For every element EmblemPrintShop extracted from an Atalanta plate, record the
one measurement the old pipeline never took: **where the thing touches the
ground**. Depth in a perspective construction comes from the foot line, not from
the bounding box centre. A tall figure and a short one standing on the same
paving stone have completely different bbox centres and identical depth.

Also assigns each element a `kind` from the five-way taxonomy in
REVISIONPROPOSAL.md sec. 2b:

    standing   contacts the ground plane      -> card at contact depth
    attached   painted/inscribed on a surface -> decal, never a free card
    architect. defines the space itself       -> geometry, not a card
    ornament   engraver's convention (clouds) -> parallax-free band
    furniture  binding/gutter/letterpress     -> excluded entirely

The auto-assignment here is a *guess* recorded as such; data/elements.overrides.json
carries hand review and always wins. Nothing downstream may treat an unreviewed
kind as settled.

Side effect: writes bbox-cropped RGBA cutouts cut from the SAME b/w Claudiens
plate the extraction was made from (summary.json's `source_image`), so cards and
backdrop are one consistent image set. The colour page-scan cutouts currently
shipped in EmblemPapercraft/images/cutouts are from a different copy of the book
at a different framing, which is why nothing registers.

Usage:  python tools/build_elements.py
"""
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(r"C:\Dev\EmblemPrintShop\assets\extracted_all")
OUT_JSON = ROOT / "data" / "elements.json"
OVERRIDES = ROOT / "data" / "elements.overrides.json"
OUT_IMG = ROOT / "site" / "assets" / "cutouts"

MAX_CUTOUT_DIM = 512          # px, longest side of the web cutout
MIN_MASK_PX = 900
ALPHA_T = 128

# Category -> first-guess kind. Deliberately conservative: anything that could be
# part of the space itself is guessed `architecture`, because a wrong `standing`
# guess produces a floating card while a wrong `architecture` guess just leaves
# the element on the backdrop where it already reads correctly.
KIND_BY_CATEGORY = {
    "figure": "standing", "figures": "standing",
    "animal": "standing", "animals": "standing",
    "equipment": "standing", "objects": "standing",
    "plants": "standing",
    "architecture": "architecture",
    "landscape": "architecture",
    "sky": "ornament",
}

ORNAMENT_WORDS = re.compile(
    r"\b(cloud|clouds|sky|scroll|banner|cartouche|ray|rays|sun|moon|star)\b", re.I)
FURNITURE_WORDS = re.compile(
    r"\b(border|frame|margin|text|caption|epigram|page|binding|gutter)\b", re.I)


def slug(stem):
    return re.sub(r"[^a-z0-9_]+", "", stem.lower().replace("_transparent", ""))


def foot_line(alpha, bbox):
    """
    Ground-contact measurement for one mask.

    Returns (contact_y, contact_x, confidence, basis).

    contact_y is the lowest image row carrying a meaningful run of mask pixels
    (not a single speckle). contact_x is the centroid of that row's run.
    Confidence drops when the mask runs off the bottom of the plate (contact is
    outside the picture) or when the base is as wide as the whole object, which
    usually means the segmentation swallowed the ground behind it.
    """
    x, y, w, h = bbox
    sub = alpha[y:y + h, x:x + w] >= ALPHA_T
    if not sub.any():
        return None, None, 0.0, "empty mask"
    rows = sub.sum(axis=1)
    thresh = max(3, int(0.02 * w))
    solid = np.nonzero(rows >= thresh)[0]
    if len(solid) == 0:
        solid = np.nonzero(rows > 0)[0]
    r = int(solid[-1])
    cols = np.nonzero(sub[r])[0]
    contact_y = y + r
    contact_x = x + float(cols.mean())

    conf, basis = 0.85, "lowest solid mask row"
    base_w = len(cols)
    if r >= h - 2 and (y + h) >= alpha.shape[0] - 2:
        conf, basis = 0.15, "mask runs off the bottom edge; contact is off-plate"
    elif base_w > 0.92 * w:
        conf, basis = 0.35, "base as wide as the whole element; segmentation may include ground"
    elif base_w < 0.04 * w:
        conf, basis = 0.55, "very narrow base; contact point may be a speckle"
    return int(contact_y), round(contact_x, 1), conf, basis


def guess_kind(label, category, bbox, W, H):
    x, y, w, h = bbox
    if FURNITURE_WORDS.search(label or ""):
        return "furniture", "label matches page furniture vocabulary"
    if ORNAMENT_WORDS.search(label or ""):
        return "ornament", "label matches engraver's-convention vocabulary"
    # anything covering more than half the plate is the scene, not a prop in it
    if (w * h) > 0.42 * W * H:
        return "architecture", "covers >42% of the plate; too large to be a free-standing prop"
    # anything wholly above the middle with no ground contact is not standing
    if (y + h) < 0.45 * H:
        return "ornament", "sits entirely in the upper plate with no ground contact"
    return KIND_BY_CATEGORY.get((category or "").lower(), "standing"), "category default"


def main():
    overrides = {}
    if OVERRIDES.exists():
        overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))

    OUT_IMG.mkdir(parents=True, exist_ok=True)
    out = {}
    n_elems = n_reviewed = 0

    for d in sorted(SRC.glob("emblem-*")):
        if not re.match(r"^emblem-\d+$", d.name):
            continue
        summ = d / "summary.json"
        if not summ.exists():
            continue
        data = json.loads(summ.read_text(encoding="utf-8"))
        plate_path = Path(data.get("source_image", ""))
        if not plate_path.exists():
            print(f"  {d.name}: source plate missing ({plate_path}) — skipped")
            continue
        plate = Image.open(plate_path).convert("RGB")
        W, H = plate.size

        edir = OUT_IMG / d.name
        elems = []
        for it in data.get("individual", []):
            bbox = it.get("tight_bbox")
            png = Path(it.get("transparent_png", ""))
            if not bbox or not png.exists():
                continue
            if it.get("mask_pixel_count", 0) < MIN_MASK_PX:
                continue
            src = Image.open(png).convert("RGBA")
            if src.size != (W, H):
                # extraction canvas must match the plate or nothing registers
                print(f"  {d.name}/{png.stem}: canvas {src.size} != plate {(W, H)} — skipped")
                continue
            alpha = np.array(src.split()[-1])
            x, y, w, h = [int(v) for v in bbox]
            cy_, cx_, cconf, cbasis = foot_line(alpha, (x, y, w, h))
            if cy_ is None:
                continue

            label = it.get("label", "")
            cat = (it.get("category") or "").lower()
            kind, kind_basis = guess_kind(label, cat, (x, y, w, h), W, H)

            # WebP with alpha: the same 150 cutouts are 33 MB as PNG and 4.6 MB
            # as WebP, and this repo has to be clonable
            name = slug(png.stem) + ".webp"
            rec = {
                "file": f"{d.name}/{name}",
                "label": label,
                "category": cat,
                "score": round(float(it.get("score", 0.0)), 3),
                "mask_px": int(it.get("mask_pixel_count", 0)),
                "bbox": [x, y, w, h],
                # normalised against the PLATE, which is also the backdrop —
                # one coordinate system for the whole scene
                "nx": round(x / W, 5), "ny": round(y / H, 5),
                "nw": round(w / W, 5), "nh": round(h / H, 5),
                "contact_y": cy_, "contact_x": cx_,
                "contact_ny": round(cy_ / H, 5), "contact_nx": round(cx_ / W, 5),
                "contact_confidence": cconf, "contact_basis": cbasis,
                "kind": kind, "kind_basis": kind_basis, "kind_reviewed": False,
            }
            ov = overrides.get(rec["file"])
            if ov:
                rec.update(ov)
                rec["kind_reviewed"] = True
                n_reviewed += 1

            # cut the element out of the b/w plate using the extraction's own alpha
            edir.mkdir(parents=True, exist_ok=True)
            crop = plate.crop((x, y, x + w, y + h)).convert("RGBA")
            crop.putalpha(Image.fromarray(alpha[y:y + h, x:x + w]))
            sc = MAX_CUTOUT_DIM / max(crop.size)
            if sc < 1:
                crop = crop.resize((max(1, round(crop.width * sc)),
                                    max(1, round(crop.height * sc))), Image.LANCZOS)
            crop.save(edir / name, "WEBP", quality=82, method=5)

            elems.append(rec)
            n_elems += 1

        num = int(d.name.split("-")[1])
        out[d.name] = {"number": num, "width": W, "height": H, "elements": elems}
        kinds = {}
        for e in elems:
            kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
        print(f"{d.name}: {len(elems):>2} elements  {kinds}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"\n{len(out)} plates | {n_elems} elements | {n_reviewed} hand-reviewed kinds")
    print(f"-> {OUT_JSON}\n-> {OUT_IMG}")


if __name__ == "__main__":
    main()

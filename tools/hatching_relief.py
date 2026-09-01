#!/usr/bin/env python
"""
hatching_relief.py — recover surface shape from the direction of the burin strokes.

WHY THIS EXISTS

`relief.js` builds every one of the 213 gallery models by driving a displacement
map from the plate's luminance: light paper stands proud, dark ink is incised.
It is a lovely effect and it is semantically inverted. In an engraving, ink
density is not height. It is TONE, and tone is shading. The darkest region of
Emblem VIII is the inside of the vault -- the part furthest away, not a groove.
The darkest part of a drawn sphere is its shadowed side. Driving displacement
from luminance produces a relief of the PLATE, not of the thing depicted.

WHAT THE MARKS ACTUALLY ENCODE

An engraver's hatching carries two independent channels, and both are invertible:

  stroke DIRECTION  ~  surface orientation. The burin follows the form; perceptual
                       work finds people read hatching strokes as curvature
                       directions (Praun/Hoppe/Webb/Finkelstein, Real-Time Hatching).
  stroke DENSITY    =  tone, which is shading -- an elevation cue, not a height.

THE INVERSION

  1. ink       = inverted, contrast-normalised plate
  2. tone      = local ink density (fraction of area that is stroke), NOT raw
                 luminance. This separates "dark because densely hatched" from
                 "dark because one thick contour line runs through here".
  3. structure tensor at stroke scale -> dominant gradient direction and coherence.
     For a field of parallel strokes the gradient runs ACROSS the strokes, so the
     stroke direction is perpendicular to it.
  4. the surface tilts across the strokes, not along them: an engraver lays strokes
     along the direction the surface is NOT bending. So the gradient of height is
     parallel to the across-stroke direction, with magnitude from tone and sign
     from which way tone increases.
  5. integrate that gradient field to a height map (Frankot-Chellappa, in the
     Fourier domain -- the least-squares surface whose gradient best matches).

  Where coherence is low (cross-hatching, stipple, open paper) the direction is
  meaningless, so the field falls back smoothly to plain shape-from-shading.

The output is a relief of the depicted FORM. A drawn sphere comes out as a cap.
The old method gives a sphere and a flat wall the same corrugated-ink surface.

Usage:  python tools/hatching_relief.py [plate ...]
        default: the three worked examples plus a few with strong modelled form
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PLATES = Path(r"C:\Dev\EmblemPrintShop\sources\claudiens\site\images\emblems")
OUT = ROOT / "site" / "assets" / "relief"

WORK = 900          # working resolution on the long side
STROKE_SIGMA = 2.2  # scale of a single burin stroke
FIELD_SIGMA = 7.0   # scale over which strokes form a coherent field
TONE_SIGMA = 9.0    # scale over which strokes read as a tone
SLOPE = 2.4         # how steeply tone maps to surface tilt
DEFAULT = ["emblem-08", "emblem-01", "emblem-21", "emblem-45", "emblem-05", "emblem-00"]


def ink_and_tone(gray):
    """Ink map (strokes, 0..1) and tone (local stroke density, 0..1)."""
    g = gray.astype(np.float32) / 255.0
    # flatten the paper: divide out the slow illumination/foxing of the scan so
    # that "how much ink" does not depend on where on the sheet you are
    paper = cv2.GaussianBlur(g, (0, 0), 40)
    flat = np.clip(g / np.maximum(paper, 0.35), 0, 1.6)
    ink = np.clip(1.0 - flat / 1.6 * 1.6, 0, 1)
    ink = (ink - ink.min()) / max(1e-6, ink.max() - ink.min())
    # tone = how much of the local area is stroke. Blurring the ink map is exactly
    # the "count of stroke area per unit area" that an engraver is modulating when
    # they space their lines wider or narrower.
    tone = cv2.GaussianBlur(ink, (0, 0), TONE_SIGMA)
    tone = np.clip((tone - np.percentile(tone, 2)) /
                   max(1e-6, np.percentile(tone, 98) - np.percentile(tone, 2)), 0, 1)
    return ink, tone


def orientation(ink):
    """Structure tensor -> stroke direction and coherence."""
    ink = cv2.GaussianBlur(ink, (0, 0), STROKE_SIGMA)
    gx = cv2.Sobel(ink, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(ink, cv2.CV_32F, 0, 1, ksize=3)
    Jxx = cv2.GaussianBlur(gx * gx, (0, 0), FIELD_SIGMA)
    Jyy = cv2.GaussianBlur(gy * gy, (0, 0), FIELD_SIGMA)
    Jxy = cv2.GaussianBlur(gx * gy, (0, 0), FIELD_SIGMA)

    # dominant GRADIENT direction; strokes run perpendicular to it
    theta_g = 0.5 * np.arctan2(2 * Jxy, Jxx - Jyy)
    tr = Jxx + Jyy
    det_term = np.sqrt(np.maximum((Jxx - Jyy) ** 2 + 4 * Jxy ** 2, 0))
    coherence = np.where(tr > 1e-9, (det_term / np.maximum(tr, 1e-9)) ** 2, 0.0)

    stroke = theta_g + np.pi / 2          # along the strokes
    across = theta_g                       # across them: the way the surface turns
    return stroke, across, np.clip(coherence, 0, 1)


def gradient_field(tone, across, coherence):
    """
    Height gradient (p, q).

    Direction: across the strokes where the stroke field is coherent; straight down
    the tone gradient where it is not (plain shape-from-shading fallback).
    Magnitude: from tone -- darker means the surface is turned further away.
    Sign: whichever way along the across-stroke axis tone is increasing.
    """
    ty = cv2.Sobel(tone, cv2.CV_32F, 0, 1, ksize=5)
    tx = cv2.Sobel(tone, cv2.CV_32F, 1, 0, ksize=5)

    ax, ay = np.cos(across), np.sin(across)
    sign = np.sign(tx * ax + ty * ay)
    sign[sign == 0] = 1.0

    mag = SLOPE * tone
    p_dir, q_dir = ax * sign * mag, ay * sign * mag       # stroke-driven

    n = np.sqrt(tx * tx + ty * ty) + 1e-6
    p_sfs, q_sfs = tx / n * mag, ty / n * mag             # shading-only fallback

    w = np.clip((coherence - 0.06) / 0.30, 0, 1)
    p = w * p_dir + (1 - w) * p_sfs
    q = w * q_dir + (1 - w) * q_sfs
    # Smooth the gradient field at stroke scale before integrating. Individual
    # strokes are evidence about the surface, not features OF the surface: without
    # this every stroke integrates into its own ridge and the result is an edge map
    # wearing a relief's clothes.
    p = cv2.GaussianBlur(p, (0, 0), 5.0)
    q = cv2.GaussianBlur(q, (0, 0), 5.0)
    return p, q, w


def integrate(p, q):
    """
    Frankot-Chellappa: the least-squares integrable surface whose gradient is
    closest to (p, q). One FFT each way; no iteration, no parameters.
    """
    H, W = p.shape
    wx = np.fft.fftfreq(W).reshape(1, W) * 2 * np.pi
    wy = np.fft.fftfreq(H).reshape(H, 1) * 2 * np.pi
    denom = wx ** 2 + wy ** 2
    denom[0, 0] = 1.0
    Z = (-1j * wx * np.fft.fft2(p) - 1j * wy * np.fft.fft2(q)) / denom
    Z[0, 0] = 0
    z = np.real(np.fft.ifft2(Z))
    z -= z.min()
    return z / max(1e-6, z.max())


def normals_from_height(z, strength=40.0):
    zy, zx = np.gradient(z * strength)
    n = np.dstack([-zx, zy, np.ones_like(z)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return (n * 0.5 + 0.5)


def split_scales(z, sigma=11.0):
    """
    Displacement carries the FORM; the normal map carries the marks.

    Vertex displacement can only resolve what the mesh has vertices for, and
    three.js does not recompute normals from a displacement map at all -- a
    displaced plane still shades as though it were flat. So the large, smooth
    component goes to displacement, where it moves real geometry and casts real
    silhouettes, and the fine component goes to a normal map, where it shades.
    Without this split the stroke-scale detail dominates the height range, the
    percentile stretch amplifies it, and a figure comes out looking like molten wax.
    """
    lo = cv2.GaussianBlur(z, (0, 0), sigma)
    a, b = np.percentile(lo, 1), np.percentile(lo, 99)
    lo = np.clip((lo - a) / max(1e-6, b - a), 0, 1)
    return lo


def flow_image(stroke, coherence, ink):
    """
    Line integral convolution: smear noise along the stroke field so the recovered
    direction field is visible as a picture rather than as a number.
    """
    H, W = stroke.shape
    rng = np.random.default_rng(7)
    noise = rng.random((H, W)).astype(np.float32)
    acc = noise.copy()
    x, y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    dx, dy = np.cos(stroke).astype(np.float32), np.sin(stroke).astype(np.float32)
    fx, fy = x.copy(), y.copy()
    bx, by = x.copy(), y.copy()
    STEPS = 14
    for _ in range(STEPS):
        fx += dx; fy += dy
        bx -= dx; by -= dy
        acc += cv2.remap(noise, fx, fy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        acc += cv2.remap(noise, bx, by, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    acc /= (2 * STEPS + 1)
    acc = (acc - acc.min()) / max(1e-6, acc.max() - acc.min())
    # tint by coherence: warm where the stroke field is trustworthy, grey where not
    c = np.clip(coherence * 3.2, 0, 1)
    img = np.dstack([acc * (0.35 + 0.65 * c),
                     acc * (0.35 + 0.42 * c),
                     acc * (0.38 + 0.10 * c)])
    img = img * (0.45 + 0.55 * (1 - ink[..., None] * 0.6))
    # cv2 writes BGR; the tint above is authored in RGB
    return (np.clip(img[..., ::-1], 0, 1) * 255).astype(np.uint8)


def process(key):
    src = PLATES / f"{key}.jpg"
    gray = cv2.imread(str(src), cv2.IMREAD_GRAYSCALE)
    if gray is None:
        print(f"  {key}: no plate")
        return None
    H0, W0 = gray.shape[:2]
    s = WORK / max(W0, H0)
    g = cv2.resize(gray, (int(W0 * s), int(H0 * s)), interpolation=cv2.INTER_AREA)

    ink, tone = ink_and_tone(g)
    stroke, across, coh = orientation(ink)
    p, q, w = gradient_field(tone, across, coh)
    z = integrate(p, q)
    # Drop only the very lowest frequencies. Poisson integration over a bounded
    # region accumulates a broad bowl that is an artefact of the boundary, not of
    # the drawing -- but subtract too much and you throw away the modelled form
    # along with it and are left looking at an edge map.
    # sigma has to be LARGER than the biggest form in the picture, or the form is
    # what gets removed. Boreas's torso is ~200 px across at this working size; a
    # 150 px high-pass deleted him and left a field of stroke-scale blobs.
    z = z - 0.45 * cv2.GaussianBlur(z, (0, 0), 260)
    lo, hi = np.percentile(z, 1), np.percentile(z, 99)
    z = np.clip((z - lo) / max(1e-6, hi - lo), 0, 1)

    OUT.mkdir(parents=True, exist_ok=True)
    # WebP throughout: the normal maps alone are 19 MB as PNG and 4 MB as WebP,
    # and this has to ship in a repository people clone.
    z_disp = split_scales(z)
    cv2.imwrite(str(OUT / f"{key}-height.webp"), (z_disp * 255).astype(np.uint8),
                [cv2.IMWRITE_WEBP_QUALITY, 95])
    nrm = normals_from_height(z, strength=26.0)
    cv2.imwrite(str(OUT / f"{key}-normal.webp"), (nrm[..., ::-1] * 255).astype(np.uint8),
                [cv2.IMWRITE_WEBP_QUALITY, 92])
    cv2.imwrite(str(OUT / f"{key}-flow.jpg"), flow_image(stroke, coh, ink),
                [cv2.IMWRITE_JPEG_QUALITY, 86])
    cv2.imwrite(str(OUT / f"{key}-tone.jpg"), (tone * 255).astype(np.uint8),
                [cv2.IMWRITE_JPEG_QUALITY, 84])
    # The old method, generated here so the A/B is like for like. relief.js feeds
    # the plate straight in as a displacement map (light paper proud, dark ink
    # incised); the only thing done differently here is the same percentile
    # normalisation the hatching map gets, so the comparison is not rigged by one
    # surface simply having more contrast to work with than the other.
    lg = g.astype(np.float32) / 255.0
    llo, lhi = np.percentile(lg, 1), np.percentile(lg, 99)
    lg = np.clip((lg - llo) / max(1e-6, lhi - llo), 0, 1)
    cv2.imwrite(str(OUT / f"{key}-luminance.webp"),
                (split_scales(lg) * 255).astype(np.uint8),
                [cv2.IMWRITE_WEBP_QUALITY, 95])
    # ...and its own normal map, by the identical route. The only difference
    # between the two surfaces on the comparison page is then where the height
    # field came from -- not how it is lit, smoothed, stretched or shaded.
    lnrm = normals_from_height(lg, strength=26.0)
    cv2.imwrite(str(OUT / f"{key}-luminance-normal.webp"),
                (lnrm[..., ::-1] * 255).astype(np.uint8),
                [cv2.IMWRITE_WEBP_QUALITY, 92])

    rec = {
        "height": f"relief/{key}-height.webp",
        "normal": f"relief/{key}-normal.webp",
        "flow": f"relief/{key}-flow.jpg",
        "tone": f"relief/{key}-tone.jpg",
        "luminance": f"relief/{key}-luminance.webp",
        "luminance_normal": f"relief/{key}-luminance-normal.webp",
        "w": int(g.shape[1]), "h": int(g.shape[0]),
        "coherent_fraction": round(float((coh > 0.06).mean()), 3),
        "stroke_driven_fraction": round(float(w.mean()), 3),
    }
    print(f"  {key}: {rec['w']}x{rec['h']}  stroke-driven {rec['stroke_driven_fraction']:.2f} "
          f"of the surface, the rest shading-only")
    return rec


def main():
    keys = sys.argv[1:] or DEFAULT
    man = {}
    for k in keys:
        r = process(k)
        if r:
            man[k] = r
    path = ROOT / "site" / "assets" / "relief" / "manifest.json"
    existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    existing.update(man)
    path.write_text(json.dumps(existing, indent=1), encoding="utf-8")
    print(f"\n{len(man)} plates -> {OUT}")


if __name__ == "__main__":
    main()

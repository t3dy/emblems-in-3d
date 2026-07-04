# Development History

EMBLEMSIN3D's per-emblem 3D scenes (`scene.html?id=af-NN`) went through several
genuinely different implementations before landing on the current one. This
page documents each stage honestly — including the two that were wrong and
were replaced after direct user pushback — and links to a **preserved, still-
running snapshot** of the stage before the current one, so you can compare
them live rather than take the description's word for it.

| Stage | What it was | Try it |
|---|---|---|
| 0 | Broken serving | — (fixed; see below) |
| 1 | Flagship hand-built environment | [`index.html`](../index.html) |
| 2 | Flat plane + framed print, primitive props | [`scene-stage2.html`](../scene-stage2.html) — **live snapshot** |
| 3 | Perspective-armature rooms, primitive props | [`scene-legacy.html`](../scene-legacy.html) — **live snapshot** |
| 4 | Papercraft tunnel-book, real cutouts | [`scene.html`](../scene.html) — **current** |

## Stage 0 — broken serving

The site was reported "not working." The actual cause: every catalogue asset
path is absolute (`/EmblemPrintShop/sources/.../emblem-08.jpg`), so the static
server has to be rooted at `C:\Dev`, not at `EMBLEMSIN3D` itself. It had been
served from the wrong directory (and 13 stray `python -m http.server`
processes were running simultaneously, likely bound to the wrong roots).
Fixed via `.claude/launch.json` (`python -m http.server 5184 --directory
C:/Dev`). No code was wrong; the deployment was.

## Stage 1 — the flagship: Emblem VIII (`main.js`, `index.html`)

Predates this development arc. A fully hand-built environment reconstructing
Emblem VIII's actual courtyard: tiled floor in perspective, crenellated walls,
a vaulted tunnel to a glowing doorway, the furnace, the philosophical egg, the
adept with his sword, the town beyond the walls, toon shading + a Sobel
ink-edge post-process for the woodcut look. This was always the reference for
what "dimensionalizing an emblem" should mean — the other 50 plates didn't
reach this bar until Stage 4.

## Stage 2 — flat plane, framed print, primitive props

The first attempt to give the other 50 plates *something*: a flat 44×44
ground plane (later textured per the emblem's setting — soil, grass,
flagstone), each emblem's catalogued `visual_elements` tags turned into
primitive props (spheres for eggs, capsules for figures, cones for fire) and
scattered across the plane by rough category, with the actual engraving
**hung on a wall as a framed picture** — literally a poster of the emblem
standing in a room, not the room the emblem depicts. Walk mode, music, the
"operate" bench-step game loop, de Jong scholarship panels, the toon+ink-edge
woodcut post-process, and hand-composed (`bespoke.js`) staging were all added
at this stage and survived every later rewrite — only the flat-plane-plus-
poster spatial idea itself was wrong.

**Still running, on purpose**, at [`scene-stage2.html`](../scene-stage2.html)
— `scene-stage2.js` restores this exact system (flat ground, `zoneOf`-based
tag scatter, the framed backdrop plate) so it can be compared directly.

## Stage 3 — perspective armatures, primitive props

**User feedback:** *"Do you not have the ability to look at the emblems and
judge the three-dimensional perspectives that the emblems create? ... I'd
like you to think hard about what I've been asking and see if you can't
simulate all the spaces that are being created by the lines and planes and
angles of the images."*

This was the first real correction: Stage 2's flat-plane-with-a-poster
completely ignored what the engravings actually construct spatially. Reading
the plates directly (not the database tags) showed they fall into a handful
of repeatable **perspective armatures** — a one-point-perspective interior box
(kitchens, labs — hearth + window + shelves), a walled court (a paved yard
receding to an arched back wall — the VIII model, generalized), a foreground-
figure landscape (near ground → river/town band → mountains → cloud-scroll
sky — the dominant type), and a diagram wall (Emblem XXI's inscribed
circle/triangle/square). `spaces.js` built these as real room geometry;
`bespoke.js` hand-composed ~50 individual plates within them; procedural
canvas textures (`textures.js`) gave floors and masonry some surface quality.

This got the *rooms* right — real perspective-consistent spaces instead of a
flat plane — but the *contents* were still synthetic 3D primitives standing
in for the actual figures: a sphere for an egg, a capsule-and-sphere peg
figure for a person, a cone-roofed box for a farmhouse. Structurally sound,
visually nothing like a 1617 engraving.

**Still running, on purpose**, at [`scene-legacy.html`](../scene-legacy.html)
— `scene-legacy.js` restores this exact system (it still imports `spaces.js`,
`bespoke.js`, `props.js`'s primitive builders) so it can be compared directly
against the current version rather than just described.

## Stage 4 — papercraft tunnel-book, real cutouts (current)

**User feedback:** *"This isn't what I'm looking for at all! I don't want you
to just make wavy 3d pop-outs I want you to reconstruct the spaces... so that
we can make papercraft emblems that are more like pop-up books where each
figure ... has its own paper cut out ... What you've built looks completely
random."*

The second, larger correction. Investigating turned up a sibling project,
**[EmblemPapercraft](../../EmblemPapercraft)**, that had already solved
exactly this: 743 figures computer-vision-cut from the 51 plates
(`EmblemPrintShop`'s extraction pipeline), each with a normalized
picture-plane position, size, and inferred pop-forward depth
(`data/layers.json`). EmblemPapercraft renders these as a fixed shadow-box you
orbit around; `papercards.js` places the *same* real cutouts at real
room-scale 3D depth instead, so walking through the scene reveals genuine
parallax — an antique **tunnel book / peepshow box**, walked into rather than
looked at from outside.

`spaces.js`/`bespoke.js`/the procedural-texture system are retired from the
main emblem scenes (kept only for `buildSpecialLab`'s generic apparatus-lab
interiors — a secondary feature, not what's shown per-emblem).

A real data-quality issue surfaced during this work and is handled
transparently rather than hidden: about 110 of the 743 cutouts are
low-confidence automated CV detections (mean confidence ≈0.32 of 1.0) and a
few are visibly wrong — e.g. Emblem VIII's cutout labelled "athanor retort" is
actually a mis-segmented crop of a robed figure's arm plus doorway masonry.
`papercards.js` renders only the reliable unscored cutouts by default, with a
`KNOWN_BAD` exclusion list for specific confirmed-bad files and a
single-best-scored-item fallback for the ~19 plates that would otherwise pop
nothing at all. See `papercards.js`'s header comment and the README's
"Emblem scenes" section for the current detail.

## The Atalanta Fugiens family

EMBLEMSIN3D is one of several projects built from the same 1617 emblem book,
sharing sources across `C:\Dev` — different media, one engraving set.
`papercards.js`'s real figure cutouts come directly from EmblemPapercraft /
EmblemPrintShop below.

| Project | What it does | Local |
|---|---|---|
| Emblems in 3D | this project — walkable papercraft tunnel-books | — |
| Emblem Papercraft | the same plates as shadow-casting paper pop-ups, orbit-viewed | `../EmblemPapercraft/` |
| Emblem Roguelike | a Dragon-Warrior-style RPG whose art is the extracted engravings | `../EmblemRoguelike/` |
| Emblem Novel | graphical text adventure built from the emblems | `../EmblemNovel/` |
| Atalanta Claudiens | DH site on H.M.E. de Jong's scholarship — the source for the "Read the emblem" panels here | `../Claudiens/` |
| Emblem Print Shop | the computer-vision pipeline that cut the 743 figures used here and in Papercraft | `../EmblemPrintShop/` |

## What this means for "which version is right"

Stage 4 is the live site. Stage 3 stays reachable specifically so a claim like
"the rooms are more spatially correct now" or "the figures are real cutouts
now" can be checked by looking, not just read. If you want the primitive-prop
system's *room* geometry (which is still arguably a reasonable way to frame a
space when no reliable cutout exists for a given area) combined with Stage
4's real cutout figures, that hybrid hasn't been built — it's a natural next
step if the current one-tunnel-per-emblem framing turns out too uniform once
you've walked all 51.

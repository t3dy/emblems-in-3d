# The Dream of Poliphilo — the second world

*Francesco Colonna,* Hypnerotomachia Poliphili *(Venice: Aldus Manutius, 1499).
A hundred and twenty-nine leaves, thirteen precincts.*

<https://t3dy.github.io/emblems-in-3d/world.html?world=poliphilo>

---

## 1. Why this book needed no invented connective tissue

The Fugitive World had a problem the Hypnerotomachia does not. *Atalanta
Fugiens* is fifty-one emblems that share a subject and a conceit but not a
place, so the world had to **invent** a course to string them on, and then mark
every metre of it as invented.

The Hypnerotomachia is already a place, and already a walk:

> Poliphilo, having wept himself to sleep for Polia, wakes inside his own dream
> in a dark wood. He escapes it into the ruins of an antiquity that never
> existed and climbs a stepped pyramid; is chased by a dragon through a
> lightless tunnel; is bathed and feasted at the court of Queen Eleuterylida;
> is led on by five nymphs who are the five senses; chooses the third of three
> doors — *Mater Amoris*, the mother of love; crosses the Polyandrion, the
> ruined burial ground of those who died for love; finds Venus asleep at her
> fountain; is joined to Polia in her temple; joins the triumphal procession;
> is rowed to Cythera by Cupid himself; and walks a garden laid out in twenty
> concentric zones. Then Polia tells the whole thing again in her own voice,
> and he wakes, and she is gone.

So the world is **thirteen precincts, in the order the book reaches them**,
threaded by a path. Nothing about the route is ours. The `narrative_section`
column of `hp.db` supplies the thirteen and their order is the order of the
leaves in the 1499 edition.

| precinct | leaves |
|---|---|
| The Dark Wood · The Great Pyramid and the Ruins · The Dragon's Tunnel | 15 · 10 · 3 |
| The Palace of Eleuterylida · The Five Nymphs · The Three Doors | 9 · 5 · 11 |
| The Polyandrion · The Fountain of Venus · The Temple of Venus Physizoa | 27 · 7 · 15 |
| The Triumphs · The Voyage · The Island of Cythera · Polia's Own Account | 27 · 2 · 30 · 17 |

A precinct is a place you stand in the *middle* of and turn around inside. Its
leaves stand on an arc of about 205°; past fourteen leaves it grows a second
concentric ring rather than a wider arc, because an arc wider than that stops
reading as a room.

## 2. The leaf is never cropped

The sources are whole Aldine pages: a block of roman type with a woodcut set
into it. Cropping to the cut is the obvious move and it is the wrong one, for
exactly the reason Phase 5 refused to invent depth — **a bad crop is invisible
once made.** You cannot tell from the result that half a cut was thrown away.

So every station is the whole leaf, at web size, exactly as it sits in the
book. What `tools/build_hp_assets.py` does instead is *locate* the woodcut and
record the rectangle, and the world uses that to **pop the cut forward off its
own leaf**, in parallel projection, with the page whole behind it. Where the
detector is not confident there is no pop and the leaf stands flat. The panel
says which happened, and why, in the detector's own words.

**How the cut is found.** Set type leaves a band of leading between every line,
so a text block's row-ink profile returns to bare paper twenty or thirty times
a page. A woodcut's ink runs continuously down the block. The cut is therefore
the longest **gap-free** run of inked rows, and it has to beat the page's own
line height by a wide margin to be believed.

The profile must not be smoothed first. Smoothing over a line pitch fills the
leading in and makes a dense text block look exactly like a woodcut — which is
how the first version of this tool found only the four full-page cuts in
twenty-four leaves.

A second, weaker test grades the find rather than vetoing it: a woodcut is
blacker than the type around it, and its row profile is ragged where type is
regular. Measured on 24 hand-checked leaves, gating the pop on all three
(confidence, ink ratio, row variation) keeps **10 of 12** true cuts and admits
**1** false one. Across all 129 leaves: 93 located, 44 confident enough to pop.

There are **no perspective solves for this corpus** and the world does not
pretend otherwise. Every station is tier `leaf`; nothing here claims a depth.

## 3. Seven levels of commentary

Same machinery as the Atalanta world, different archetypes, all compiled from
`hp.db` by `tools/build_hp_world.py` — 332 boxes across 129 leaves.

| archetype | colour | what it is |
|---|---|---|
| `title` | near-black | the cut, with its 1499 signature and page, and the chapter it sits in |
| `image` | grey | what the block actually depicts |
| `narrative` | dark brown | where this is in the dream |
| `scholarship` | blue | what scholars have said about it, with its source basis |
| `influence` | green | what it went on to do — the HP fed a century of garden and festival design |
| `elements` | grey | the elements catalogued on the cut |
| `term` | teal | the dictionary entry behind a motif, and why it matters to the book |
| `marginalia` | red | *an alchemist read this page* — leaves carrying alchemical marginalia in the annotated copies |

That last one is the thread between the two worlds. Sixteenth- and
seventeenth-century readers took the Hypnerotomachia as an alchemical allegory
and wrote their readings into the margins; Maier's book is what that reading
became a century later, next door in this same site.

## 4. One engine, two worlds

`world.html?world=atalanta|poliphilo` loads `data/worlds/<id>.json`. A world
file brings its own stations, path, colours, commentary archetypes, station
tiers and routes. `main.js`, `course.js`, `station.js` and `settings.js` know
nothing about either book:

- **`station.js`** understands three tiers — `measured` (a room, depths from
  the plate's own pinhole), `conjectural` (a cut sheet, parallel pop) and
  `leaf` (a whole page, parallel pop of a located cut) — and takes either a
  road-and-bay placement or an outright `pos` + `face_deg`.
- **`course.js`** takes an explicit `path` polyline when a world has one, and
  its colour gradient samples precincts when a world has those.
- **`settings.js`** now holds 25 archetypes: the 15 Atalanta settings read off
  Maier's epigrams, authored at bay scale, plus 10 Poliphilo precincts authored
  at precinct scale with a clear middle out to 32 m.

A third world is now a builder script and a handful of archetypes.

## 5. Routes

| route | what it is |
|---|---|
| **The dream in order** | the book as Aldus printed it, which is also the order Poliphilo walks |
| **By kind of cut** | the same leaves regrouped by what the block depicts — landscape, architectural, narrative, procession, hieroglyphic, diagram, portrait, decorative. Colonna's book is an argument about images, and this is that argument sorted. |
| **Free explore** | no tour |

## 6. What it does not do yet

- **No solves.** Many of these cuts *are* ruled perspective constructions — the
  pyramid, the portal, the temple front — and the Phase 5 solver has never been
  pointed at them. The equal-height figure construction
  (`tools/equal_height_horizon.py`) would work on the procession leaves, which
  are full of standing figures on one ground plane.
- **The precincts are archetypes, not reconstructions.** The pyramid in the
  world is *a* stepped pyramid, not *the* one Colonna measures to the foot over
  several pages. Building it from his own numbers is the obvious next thing,
  and the text to do it from is in `hp.db`.
- **No cutouts.** The Atalanta world can lift figures off a plate because
  EmblemPrintShop segmented them. Nothing has segmented the 1499 blocks.

## 7. Files

```
tools/build_hp_assets.py  -> site/assets/hp/      129 whole leaves + the located cuts
tools/build_hp_world.py   -> site/data/worlds/poliphilo.json
site/js/world/            the shared engine (see docs/WORLD.md)
```

Sources: `C:/Dev/hypnerotomachia polyphili/db/hp.db` (129 woodcut records with
title, chapter context, description, narrative context, scholarly discussion,
depicted elements and dictionary links; 168 catalogue rows carrying the
narrative sections; 101 dictionary terms) and its
`site/images/woodcuts_1499/` (162 page scans).

# DEPLOY_STATE — Emblems in 3D

Read this before touching anything to do with hosting. There are two serving
paths in this repository and they have different roots, which is the single
thing most likely to waste an hour.

Last verified: **2026-09-04** (fetched the live URL and checked what it served).

---

## 1. The canonical production URL

**<https://t3dy.github.io/emblems-in-3d/>**

GitHub Pages, from `github.com/t3dy/emblems-in-3d`. There is **no** Actions
workflow in this repo — Pages is configured in the repository settings and
serves the **`site/` folder as the site root**. Verified by fetching the URL:
the page it returns is `site/index.html`.

So the mapping is:

| in the repo | on the web |
|---|---|
| `site/index.html` | `https://t3dy.github.io/emblems-in-3d/` |
| `site/world.html` | `https://t3dy.github.io/emblems-in-3d/world.html` |
| `site/data/world.json` | `…/data/world.json` |
| `site/assets/hatch/tam.png` | `…/assets/hatch/tam.png` |
| `site/assets/audio/fugues.json` | `…/assets/audio/fugues.json` |
| `site/js/world/vendor/chiptune.js` | `…/js/world/vendor/chiptune.js` |

**Every path inside `site/` must therefore be relative to `site/`**, never to
the repository root and never absolute from `C:\Dev`. The Phase 5 pages, the
Phase 7 world, `world.json`, the plates, the cutouts and the hatch TAM all obey
this. Anything that does not will 404 in production while working perfectly on
the local server described next.

## 2. The local server, and why it is rooted somewhere else

```bash
python -m http.server 5184 --directory C:/Dev
```

- Phase 7 world: <http://localhost:5184/EMBLEMSIN3D/site/world.html>
- Phase 5 site: <http://localhost:5184/EMBLEMSIN3D/site/index.html>
- pre-Phase-5 pages: <http://localhost:5184/EMBLEMSIN3D/gallery.html>

It is rooted at `C:\Dev`, not at this repository, because the **pre-Phase-5
pages** (`gallery.html`, `grandtour.html`, `history.html`, `jukebox.html`,
`experiments.html`, the relief gallery) load their images by absolute path out
of sibling projects — `/EmblemPrintShop/sources/claudiens/...`,
`/Claudiens/...`, the OCCULTIMGDB plates. Those pages therefore **cannot be
published** and are local-only by design. Do not "fix" them by copying assets
into `site/`; that is ~1,300 plates.

The launch config for this is `.claude/launch.json` → `emblems3d` (port 5184).
The review app is a second config, `review`, on port 8770.

## 3. What is generated, and must be rebuilt before publishing

Nothing under `site/` except the HTML shells and the CSS is written by hand.
If you change any of the sources, re-run the generator and commit its output —
Pages serves files, it does not run Python.

```bash
python tools/solve_perspective.py      # -> data/perspective.json
python tools/build_elements.py         # -> data/elements.json + site/assets/cutouts/
python tools/build_web_assets.py       # -> site/assets/{plates,ground}/ + manifest.json
python tools/render_solve_overlay.py   # -> site/assets/solve/
python tools/build_site_pages.py       # -> site/plates.html, site/examples.html
python tools/build_hatch_tam.py        # -> site/assets/hatch/tam.png + tam.json
python tools/build_world.py            # -> site/data/world.json
```

`build_world.py` reads **`C:/Dev/Claudiens/db/atalanta.db`**, which is *not* in
this repository. That is deliberate — the scholarship lives in Claudiens and is
cited from here — but it means the world's text cannot be regenerated on a
machine that does not have the Claudiens checkout. `site/data/world.json` is
committed for exactly that reason: it is the published artefact, not a cache.

## 4. Gotchas actually encountered

- **`site/` is the web root.** `site/js/world/main.js` fetches `data/world.json`,
  not `site/data/world.json`. Getting this backwards works locally (where the
  server is rooted at `C:\Dev`) only if you also get the prefix wrong, so the
  two errors can cancel out in dev and both surface in production.
- **`site.css` follows the OS colour scheme**; in dark mode its `--ink` is a
  pale cream. `world.css` re-tokenises `.btn` under `body.world` because the
  world is always ink on paper. If you add a shared control to `world.html`,
  check it in both schemes.
- **No build step, no bundler.** three.js comes from a jsDelivr import map
  pinned to `0.160.0` in each page's `<script type="importmap">`. If you bump
  it, bump it in every page — `reconstruct.html`, `relief.html`, `world.html`.
- **The three.js CDN is a third-party dependency of the published site.** If
  jsDelivr is unreachable the world does not load at all. Vendoring
  `three.module.js` into `site/vendor/` is the fix if that ever matters.
- **The fugues and the synth are vendored, not referenced.** `chiptune.js`
  defaults to loading `/EmblemRoguelike/assets/fugues.json`, an absolute path
  outside the published root that only resolves on the local `C:\Dev` server.
  `site/js/world/vendor/` holds copies and `main.js` passes
  `assets/audio/fugues.json` explicitly. If the fugue data changes in
  EmblemRoguelike, re-copy it.
- **GPU memory.** The world streams plate textures (nearest eleven stations
  resident). Do not "simplify" that by loading all 51: it is ~250 MB.

## 5. Publishing checklist

1. Re-run whichever generators are affected (§3).
2. Load `http://localhost:5184/EMBLEMSIN3D/site/world.html` and check the
   console is clean — one banner log line, no errors.
3. Walk to a measured station (`?station=8`), press <kbd>G</kbd>, and confirm
   the gate still lines up. That is the project's actual regression test.
4. Commit the generated files under `site/` along with the source change.
5. Push to `origin/master`. Pages rebuilds from the branch; give it a minute.
6. **Fetch the live URL and look at it** before saying it is deployed.

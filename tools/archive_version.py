#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
archive_version.py - freeze the current world as a numbered, still-visitable version.

The world is going to keep changing, and a version that only exists in git
history is a version nobody can visit. So each time the world changes shape
enough to matter, it gets frozen into `site/vN/` and stays reachable at its own
URL forever.

What is frozen, and what is not:

  FROZEN, copied into site/vN/
    world.html, css/world.css, js/world/**, data/**   the code and the content
    a MANIFEST.json saying what it was, when, and from which commit

  SHARED, left in site/assets/ and referenced as ../assets/
    plates, cutouts, the hatch TAM, the fugues, the 1499 leaves

Assets are shared on purpose. They are ~60 MB and they are *facts* - scans of
1617 and 1499 sheets - so they do not change when the world does. If a future
version ever needs to change an asset rather than add one, that version must
copy the asset too and the manifest here must say so.

The archived copy is rewritten as it is copied: its asset base becomes
`../assets`, and a banner is injected saying which version it is and linking
to the current one. Nothing else is edited.

Usage:
  python tools/archive_version.py --version v1 --label "The Fugitive World" \\
      --note "51 Atalanta stations, one race course."
  python tools/archive_version.py --list
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
INDEX = SITE / "data" / "versions.json"

COPY = [
    ("world.html", "world.html"),
    ("css/world.css", "css/world.css"),
    # site.css is shared UI chrome, but a frozen version must not change when
    # the current site's chrome does, so it is copied rather than referenced.
    ("css/site.css", "css/site.css"),
]
COPY_TREES = [
    ("js/world", "js/world"),
    ("data", "data"),
]


def git(*args, default=""):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                              text=True, encoding="utf-8", errors="replace"
                              ).stdout.strip() or default
    except Exception:
        return default


def banner_html(version, label, note):
    return (
        '\n<div class="w-archived">\n'
        '  <b>%s &mdash; archived %s.</b> %s\n'
        '  This copy is frozen and will not change. '
        '  <a href="../world.html">Go to the current world</a> &middot; '
        '  <a href="../versions.html">all versions</a>\n'
        '</div>\n' % (label, version, note)
    )


ARCHIVED_CSS = """
/* injected by tools/archive_version.py */
.w-archived {
  position: fixed; left: 50%; top: 3.2rem; transform: translateX(-50%);
  z-index: 26; max-width: min(52rem, 92vw); text-align: center;
  background: #f6edd2; color: #241d16; border: 1px solid #8a6a2a;
  border-left-width: 5px; padding: .5rem .9rem; font-size: .86rem; line-height: 1.5;
}
.w-archived a { color: #7a5a10; }
/* make room for the banner */
body.world .w-routebar { top: 7.2rem; }
body.world .w-panel { top: 7.2rem; }
"""


def rewrite_asset_base(text):
    """The archived copy lives one directory deeper, so its assets are ../assets."""
    text = text.replace('assetBase: "assets"', 'assetBase: "../assets"')
    text = text.replace('loadTam("assets/hatch/tam.png")', 'loadTam("../assets/hatch/tam.png")')
    text = text.replace('"assets/audio/fugues.json"', '"../assets/audio/fugues.json"')
    text = re.sub(r'`assets/\$\{', '`../assets/${', text)
    return text


def archive(version, label, note):
    dest = SITE / version
    if dest.exists():
        raise SystemExit("%s already exists - versions are frozen, pick a new number"
                         % dest.relative_to(ROOT))

    commit = git("rev-parse", "HEAD", default="unknown")
    subject = git("log", "-1", "--pretty=%s", default="")

    for src_rel, dst_rel in COPY:
        src, dst = SITE / src_rel, dest / dst_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    for src_rel, dst_rel in COPY_TREES:
        src, dst = SITE / src_rel, dest / dst_rel
        if src.exists():
            shutil.copytree(src, dst)

    # rewrite the copied JS so it reaches the shared assets
    for js in (dest / "js").rglob("*.js"):
        js.write_text(rewrite_asset_base(js.read_text(encoding="utf-8")), encoding="utf-8")

    # css: keep its own, plus the archived banner
    css = dest / "css" / "world.css"
    css.write_text(css.read_text(encoding="utf-8") + ARCHIVED_CSS, encoding="utf-8")

    # html: the banner, and a title that says which version this is
    html = (dest / "world.html").read_text(encoding="utf-8")
    html = html.replace("<title>", "<title>%s &mdash; " % version, 1)
    html = html.replace('<canvas id="w-canvas"></canvas>',
                        '<canvas id="w-canvas"></canvas>' + banner_html(version, label, note))
    (dest / "world.html").write_text(html, encoding="utf-8")

    manifest = {
        "version": version,
        "label": label,
        "note": note,
        "archived": date.today().isoformat(),
        "from_commit": commit,
        "commit_subject": subject,
        "url": "%s/world.html" % version,
        "frozen": [c[1] for c in COPY] + [c[1] + "/**" for c in COPY_TREES],
        "shared_with_current": ["assets/**"],
        "why_shared": "Assets are scans of 1617 and 1499 sheets: facts, not code. "
                      "They do not change when the world does. A version that needs "
                      "to CHANGE an asset must copy it and say so here.",
    }
    (dest / "MANIFEST.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False),
                                        encoding="utf-8")

    versions = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {"versions": []}
    versions["versions"] = [v for v in versions["versions"] if v["version"] != version]
    versions["versions"].append(manifest)
    versions["versions"].sort(key=lambda v: v["version"])
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(versions, indent=1, ensure_ascii=False), encoding="utf-8")

    n = sum(1 for _ in dest.rglob("*") if _.is_file())
    mb = sum(f.stat().st_size for f in dest.rglob("*") if f.is_file()) / 1e6
    print("archived %s as %s: %d files, %.1f MB" % (label, version, n, mb))
    print("  visitable at site/%s/world.html" % version)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version")
    ap.add_argument("--label", default="")
    ap.add_argument("--note", default="")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if args.list:
        if not INDEX.exists():
            print("no versions archived yet")
            return
        for v in json.loads(INDEX.read_text(encoding="utf-8"))["versions"]:
            print("%-4s %-28s %s  %s" % (v["version"], v["label"], v["archived"],
                                         v["from_commit"][:8]))
        return

    if not args.version:
        raise SystemExit("--version vN required (or --list)")
    archive(args.version, args.label or args.version, args.note)


if __name__ == "__main__":
    main()

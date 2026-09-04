#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publish_pages.py - copy site/ onto the gh-pages branch and push it.

This repository publishes to <https://t3dy.github.io/emblems-in-3d/> from a
**gh-pages branch whose root is the CONTENTS of site/**, not from a folder on
main. That was done by hand until now, which is exactly the kind of thing that
gets forgotten between sessions, so it is a script.

What it does:

  1. checks out gh-pages into a temporary git worktree
  2. deletes everything there except .git and .nojekyll
  3. copies site/ into it
  4. writes .nojekyll (GitHub Pages otherwise runs Jekyll, which silently
     drops any file or directory beginning with an underscore)
  5. commits with the main-branch commit it was built from, and pushes
  6. removes the worktree

Nothing is generated here. Run the pipeline first (see DEPLOY_STATE.md sec.3);
this only publishes what is already in site/.

Usage:
    python tools/publish_pages.py                  # publish
    python tools/publish_pages.py --dry-run        # show what would change
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
BRANCH = "gh-pages"
KEEP = {".git", ".nojekyll"}


def run(args, cwd=None, check=True):
    r = subprocess.run(args, cwd=cwd, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        sys.exit("$ %s\n%s%s" % (" ".join(args), r.stdout, r.stderr))
    return r.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--message", default=None)
    args = ap.parse_args()

    if not (SITE / "index.html").exists():
        sys.exit("no site/index.html — nothing to publish")

    head = run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT)
    subject = run(["git", "log", "-1", "--pretty=%s"], cwd=ROOT)
    # Windows encodes argv in the ANSI codepage, so a message carrying an em
    # dash arrives in git as mojibake. Commit subjects here stay ASCII.
    subject = subject.encode("ascii", "replace").decode("ascii")
    msg = args.message or "Publish %s - %s" % (head, subject)

    run(["git", "fetch", "origin", BRANCH], cwd=ROOT, check=False)

    tmp = Path(tempfile.mkdtemp(prefix="ghpages-"))
    wt = tmp / "wt"
    print("worktree: %s" % wt)
    run(["git", "worktree", "add", "-f", str(wt), BRANCH], cwd=ROOT)

    try:
        removed = 0
        for p in wt.iterdir():
            if p.name in KEEP:
                continue
            removed += 1
            if not args.dry_run:
                shutil.rmtree(p) if p.is_dir() else p.unlink()
        copied = 0
        for p in SITE.rglob("*"):
            rel = p.relative_to(SITE)
            dst = wt / rel
            if p.is_dir():
                if not args.dry_run:
                    dst.mkdir(parents=True, exist_ok=True)
            else:
                copied += 1
                if not args.dry_run:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(p, dst)
        if not args.dry_run:
            (wt / ".nojekyll").write_text("", encoding="utf-8")

        print("removed %d top-level entries, copied %d files" % (removed, copied))
        if args.dry_run:
            print("dry run — nothing written")
            return

        run(["git", "add", "-A"], cwd=wt)
        status = run(["git", "status", "--porcelain"], cwd=wt)
        if not status:
            print("gh-pages is already identical to site/ — nothing to publish")
            return
        print("%d paths changed" % len(status.splitlines()))
        run(["git", "commit", "-m", msg], cwd=wt)
        run(["git", "push", "origin", BRANCH], cwd=wt)
        print("pushed %s: %s" % (BRANCH, msg))
        print("live in a minute at https://t3dy.github.io/emblems-in-3d/")
    finally:
        run(["git", "worktree", "remove", "--force", str(wt)], cwd=ROOT, check=False)
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python
"""
Local review server for the Phase 5 reconstructions.

Same shape as EmblemPrintShop's prototype/serve.py — stdlib only, project root
as the file root, a couple of POST endpoints that write real files — but with one
difference that matters: EmblemPrintShop's review page has a working
/api/save-review endpoint that the page never calls, so its decisions live in
browser localStorage and die with the profile. This one writes to disk on every
click, and the writes feed the pipeline rather than sitting beside it.

Endpoints
  GET  /api/decisions            -> review/decisions.json
  POST /api/decisions            {key, status, note}       -> review/decisions.json
  POST /api/element-kind         {file, kind}              -> data/elements.overrides.json
  POST /api/horizon              {key, horizon_ny, note}   -> data/perspective.overrides.json
  GET  /api/progress             -> counts by status

The last two write into the SAME override files the pipeline reads, so a
correction made here changes the next build. Re-run:
    python tools/build_elements.py        (after element-kind changes)
    python tools/solve_perspective.py     (after horizon changes)
    python tools/render_solve_overlay.py && python tools/build_web_assets.py

Usage:
    python review/serve.py
    -> http://localhost:8770/review/
"""
import http.server
import json
import socketserver
import sys
from datetime import datetime, timezone
from pathlib import Path

PORT = 8770
ROOT = Path(__file__).resolve().parent.parent
DECISIONS = ROOT / "review" / "decisions.json"
ELEM_OVERRIDES = ROOT / "data" / "elements.overrides.json"
PERSP_OVERRIDES = ROOT / "data" / "perspective.overrides.json"
FIGURES = ROOT / "data" / "figures.json"

sys.path.insert(0, str(ROOT / "tools"))
try:
    from equal_height_horizon import solve_plate, basis_string
except Exception as _e:                                    # pragma: no cover
    solve_plate = basis_string = None
    print("equal-height estimator unavailable:", _e)

VALID_STATUS = {"unreviewed", "accepted", "rejected", "noted"}
VALID_KINDS = {"standing", "attached", "architecture", "ornament", "furniture"}


def load(path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"  ! {path.name} is not valid JSON; refusing to clobber it")
            raise
    return default


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)          # atomic-ish: never leave a half-written decision file


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1]) not in ("200", "304"):
            super().log_message(fmt, *args)

    def _json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    # ---------------------------------------------------------------- GET ---
    def do_GET(self):
        if self.path.startswith("/api/decisions"):
            return self._json(200, load(DECISIONS, {}))
        if self.path == "/api/figures":
            return self._json(200, load(FIGURES, {}))
        if self.path.startswith("/api/progress"):
            d = load(DECISIONS, {})
            counts = {s: 0 for s in VALID_STATUS}
            for v in d.values():
                counts[v.get("status", "unreviewed")] = counts.get(v.get("status", "unreviewed"), 0) + 1
            return self._json(200, counts)
        if self.path in ("/review", "/review/"):
            self.send_response(302)
            self.send_header("Location", "/review/index.html")
            self.end_headers()
            return
        return super().do_GET()

    # --------------------------------------------------------------- POST ---
    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n))
        except Exception:
            return self._json(400, {"error": "bad JSON body"})

        if self.path == "/api/decisions":
            return self._save_decision(data)
        if self.path == "/api/element-kind":
            return self._save_kind(data)
        if self.path == "/api/ai-fill":
            return self._save_ai_fill(data)
        if self.path == "/api/horizon":
            return self._save_horizon(data)
        if self.path == "/api/figures":
            return self._save_figures(data)
        return self._json(404, {"error": f"unknown endpoint {self.path}"})

    def _save_figures(self, data):
        """Mark standing figures, and get the horizon they imply.

        This is the estimator PROPOSAL_PHASE6 sec.1 said the corpus needs and
        could not have, because the extractor finds five figures in fifty-one
        plates. It is available here the other way round: a person marks the
        head and the foot of two or more figures who are standing on the same
        ground, and the equal-height construction returns the horizon WITHOUT
        any assumption about how tall they are.

        Marking is saved always. Writing the horizon into the override file
        happens only when the caller asks for it, because a mark is an
        observation and an override is a claim.
        """
        if solve_plate is None:
            return self._json(500, {"error": "tools/equal_height_horizon.py did not import"})
        key = str(data.get("key", "")).strip()
        figs = data.get("figures") or []
        if not key:
            return self._json(400, {"error": "missing key"})
        clean = []
        for i, f in enumerate(figs):
            try:
                head = [float(f["head"][0]), float(f["head"][1])]
                foot = [float(f["foot"][0]), float(f["foot"][1])]
            except Exception:
                return self._json(400, {"error": f"figure {i} needs head and foot as [x, y]"})
            if not all(0.0 <= v <= 1.0 for v in head + foot):
                return self._json(400, {"error": f"figure {i} has a point outside the plate"})
            if foot[1] <= head[1]:
                return self._json(400, {"error": f"figure {i}: the foot must be BELOW the head"})
            clean.append({"name": str(f.get("name") or f"figure {i + 1}"),
                          "head": head, "foot": foot})

        store = load(FIGURES, {})
        entry = store.get(key, {})
        entry["figures"] = clean
        entry["marked_at"] = stamp()
        if "verified" in data:
            entry["verified"] = bool(data["verified"])
        entry.setdefault("verified", False)
        if data.get("note"):
            entry["note"] = str(data["note"])
        store[key] = entry
        save(FIGURES, store)

        persp = load(ROOT / "data" / "perspective.json", {})
        p = persp.get(key) or {}
        res = solve_plate(entry, p.get("width", 1600), p.get("height", 1373))
        print(f"  {key}: {len(clean)} figures marked -> "
              f"{'ny %.4f' % res['horizon_ny'] if res.get('ok') else res.get('why')}")

        if res.get("ok") and data.get("commit"):
            ov = load(PERSP_OVERRIDES, {})
            rec = ov.get(key, {})
            rec["horizon_ny"] = round(res["horizon_ny"], 4)
            rec["horizon_y"] = round(res["horizon_y"], 1)
            rec["horizon_tilt_deg"] = round(res["tilt_deg"], 3)
            rec["horizon_basis"] = basis_string(res, entry)
            rec["horizon_method"] = "equal-height"
            rec["horizon_verified"] = bool(entry.get("verified"))
            if res.get("eye"):
                rec["eye_height_m"] = round(res["eye"]["eye_height_m"], 3)
                rec["eye_height_basis"] = res["eye"]["note"]
            rec["confidence"] = 0.8 if entry.get("verified") else 0.5
            rec["reviewed_by"] = f"review app, equal-height {stamp()}"
            ov[key] = rec
            save(PERSP_OVERRIDES, ov)
            res["committed"] = True

        return self._json(200, {"ok": True, "key": key, "figures": clean, "solve": res,
                                "rerun": "python tools/solve_perspective.py && python tools/build_world.py"})

    def _save_ai_fill(self, data):
        """Flag an element as 'fill the missing part in with AI later'.

        Cutouts of things that stood BEHIND something else come out with holes:
        the engraver never drew the wall behind the figure, so there is nothing
        to extract there. That is an absence of evidence, and this flag is a
        queue of those absences — not a licence to quietly invent pixels.

        Anything generated to fill one of these holes must stay distinguishable
        from the engraved source (see docs/AI_FILL.md): the fill is a separate
        layer with its own provenance, never painted into the extracted asset.
        """
        f = str(data.get("file", "")).strip()
        if not f:
            return self._json(400, {"error": "missing file"})
        want = bool(data.get("needs_ai_fill"))
        ov = load(ELEM_OVERRIDES, {})
        rec = ov.get(f, {})
        rec["needs_ai_fill"] = want
        rec["ai_fill_note"] = str(data.get("note") or "")
        rec["ai_fill_status"] = "queued" if want else "not-needed"
        rec["ai_fill_flagged_at"] = stamp()
        ov[f] = rec
        save(ELEM_OVERRIDES, ov)
        print(f"  element {f}: needs_ai_fill -> {want}")
        return self._json(200, {"ok": True, "file": f, "needs_ai_fill": want})

    def _save_decision(self, data):
        key = str(data.get("key", "")).strip()
        status = data.get("status", "unreviewed")
        if not key:
            return self._json(400, {"error": "missing key"})
        if status not in VALID_STATUS:
            return self._json(400, {"error": f"status must be one of {sorted(VALID_STATUS)}"})
        d = load(DECISIONS, {})
        entry = d.get(key, {})
        entry["status"] = status
        if "note" in data:
            entry["note"] = str(data["note"])
        entry["updated"] = stamp()
        d[key] = entry
        save(DECISIONS, d)
        print(f"  {key}: {status}" + ("  +note" if entry.get("note") else ""))
        return self._json(200, {"ok": True, "key": key, "entry": entry})

    def _save_kind(self, data):
        """Write a corrected element kind straight into the pipeline's override file."""
        f = str(data.get("file", "")).strip()
        kind = data.get("kind")
        if not f:
            return self._json(400, {"error": "missing file"})
        if kind not in VALID_KINDS:
            return self._json(400, {"error": f"kind must be one of {sorted(VALID_KINDS)}"})
        ov = load(ELEM_OVERRIDES, {})
        base = f
        rec = ov.get(base, {})
        rec["kind"] = kind
        rec["kind_basis"] = "hand review in the local review app"
        rec["reviewed_at"] = stamp()
        ov[base] = rec
        save(ELEM_OVERRIDES, ov)
        print(f"  element {base}: kind -> {kind}")
        return self._json(200, {"ok": True, "file": base, "kind": kind,
                                "rerun": "python tools/build_elements.py"})

    def _save_horizon(self, data):
        key = str(data.get("key", "")).strip()
        try:
            ny = float(data.get("horizon_ny"))
        except (TypeError, ValueError):
            return self._json(400, {"error": "horizon_ny must be a number"})
        if not key or not (0.0 < ny < 1.0):
            return self._json(400, {"error": "need key and 0 < horizon_ny < 1"})
        ov = load(PERSP_OVERRIDES, {})
        rec = ov.get(key, {})
        rec["horizon_ny"] = round(ny, 5)
        rec["horizon_basis"] = str(data.get("note") or "placed by hand in the local review app")
        rec["reviewed_by"] = f"review app {stamp()}"
        rec["confidence"] = max(float(rec.get("confidence", 0) or 0), 0.6)
        # solve_perspective.py works in pixels; it recomputes horizon_ny from
        # horizon_y, so the pixel value is the one that has to be written
        persp = load(ROOT / "data" / "perspective.json", {})
        H = (persp.get(key) or {}).get("height")
        if H:
            rec["horizon_y"] = round(ny * H, 1)
        ov[key] = rec
        save(PERSP_OVERRIDES, ov)
        print(f"  {key}: horizon_ny -> {ny}")
        return self._json(200, {"ok": True, "key": key, "horizon_ny": ny,
                                "rerun": "python tools/solve_perspective.py"})


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    try:
        load(DECISIONS, {}); load(ELEM_OVERRIDES, {}); load(PERSP_OVERRIDES, {})
    except json.JSONDecodeError:
        sys.exit(1)
    print(f"Emblems in 3D — review server\n  root: {ROOT}\n  open: http://localhost:{PORT}/review/\n")
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")

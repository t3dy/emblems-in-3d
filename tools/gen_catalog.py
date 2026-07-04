#!/usr/bin/env python3
"""Generate catalog.js (all plate collections) and processmap.js (every plate
id -> alchemical process key) for the Emblems-in-3D gallery.

Sources (image paths are root-absolute; serve C:/Dev as the static root):
  - Atalanta Fugiens emblems          (Claudiens)
  - Hypnerotomachia Poliphili woodcuts (EmblemPrintShop)
  - OCCULTIMGDB alchemy-family works   (alchemy/hermetic/rosicrucian/theosophy)
  - TheosophicalAlchemyDB adept figures
"""
import os, re, json, sqlite3
from collections import Counter, defaultdict

DEV = r"C:/Dev"
OUT = os.path.join(DEV, "EMBLEMSIN3D", "catalog.js")
PMAP_OUT = os.path.join(DEV, "EMBLEMSIN3D", "processmap.js")

AF_DIR = "EmblemPrintShop/sources/claudiens/site/images/emblems"
HP_DIR = "EmblemPrintShop/sources/hypnerotomachia-polyphili/site/images/woodcuts_1499"
AF_DB = os.path.join(DEV, "Claudiens", "db", "atalanta.db")
OCC_CATALOG = os.path.join(DEV, "OCCULTIMGDB", "data", "catalog.json")
TAD_FIGS = "TheosophicalAlchemyDB/site/images/figures"

ROMAN = ["", "I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI","XXII","XXIII","XXIV","XXV","XXVI","XXVII","XXVIII","XXIX","XXX","XXXI","XXXII","XXXIII","XXXIV","XXXV","XXXVI","XXXVII","XXXVIII","XXXIX","XL","XLI","XLII","XLIII","XLIV","XLV","XLVI","XLVII","XLVIII","XLIX","L"]

PROC_KEYS = ["calcination","solution","separation","conjunction","putrefaction","congelation","cibation","sublimation","distillation","digestion","fermentation","fixation","fusion","exaltation","multiplication","projection"]
STAGE_DEFAULT = {"NIGREDO":"calcination","ALBEDO":"congelation","CITRINITAS":"fermentation","RUBEDO":"multiplication","":"digestion"}
KW = [
    (r"egg|gladio|sword", "digestion"), (r"distil|alembic|still", "distillation"),
    (r"bath|steam|swim|sea|wash|river|water|dew|fountain", "solution"),
    (r"burn|fire|fiery|salamander|flame|furnace|athanor", "calcination"),
    (r"dragon|devour|tail|putref|rot|black|toad|grave|tomb|death|raven|crow", "putrefaction"),
    (r"wolf|dog|bite|sphinx|boar|sever|behead", "separation"),
    (r"join|marry|wedd|hermaphrodit|conjunc|union|coitus|king and queen|sol and luna", "conjunction"),
    (r"white|latona|swan|albedo|dove|silver|moon|luna", "congelation"),
    (r"sow|seed|earth|grow|tree|garden|harvest", "fermentation"),
    (r"gold|projection|tincture|red king|rubedo|pelican|phoenix|sun|sol", "projection"),
    (r"multipl|increase", "multiplication"),
    (r"sublim|smoke|flowers|spirit rises|eagle|bird", "sublimation"),
    (r"fix|stone|coral|crystal|hard|salt", "fixation"),
    (r"regulus|antimony|mars|vulcan|ore|metal|melt|crucible|star", "fusion"),
]

def proc_from_text(text, fallback_idx, stage=None):
    t = (text or "").lower()
    for pat, key in KW:
        if re.search(pat, t):
            return key
    if stage is not None:
        return STAGE_DEFAULT.get((stage or "").upper().strip(), PROC_KEYS[fallback_idx % len(PROC_KEYS)])
    return PROC_KEYS[fallback_idx % len(PROC_KEYS)]

pmap = {}

# ---------- Atalanta Fugiens ----------
mottos, stages = {}, {}
try:
    con = sqlite3.connect(AF_DB); con.row_factory = sqlite3.Row
    for r in con.execute("SELECT number, motto_english, alchemical_stage FROM emblems"):
        mottos[r["number"]] = (r["motto_english"] or "").replace("\n", " ").strip()
        stages[r["number"]] = r["alchemical_stage"] or ""
    con.close()
except Exception as e:
    print("warn: AF db:", e)

af = []
for f in sorted(os.listdir(os.path.join(DEV, AF_DIR))):
    if not re.match(r"emblem-\d+\.jpg$", f): continue
    n = int(re.search(r"(\d+)", f).group(1))
    title = "Frontispiece — Atalanta Fugiens" if n == 0 else (f"Emblem {ROMAN[n]} — {mottos.get(n,'')}".strip(" —") or f"Emblem {ROMAN[n]}")
    pid = f"af-{n:02d}"
    af.append({"id": pid, "book": "atalanta", "n": n, "title": title, "img": f"/{AF_DIR}/{f}"})
    pmap[pid] = proc_from_text(mottos.get(n, ""), n, stages.get(n))

# ---------- Hypnerotomachia ----------
hp = []
for i, f in enumerate(sorted(x for x in os.listdir(os.path.join(DEV, HP_DIR)) if re.match(r"hp1499_p\d+\.jpg$", x))):
    fol = re.search(r"_p(\d+)", f).group(1)
    pid = f"hp-{fol}"
    hp.append({"id": pid, "book": "hypnerotomachia", "n": i + 1,
               "title": f"Woodcut {i+1} — Hypnerotomachia Poliphili (1499), fol. {int(fol)}",
               "img": f"/{HP_DIR}/{f}"})
    pmap[pid] = PROC_KEYS[i % len(PROC_KEYS)]

# ---------- OCCULTIMGDB (alchemy family) ----------
collections = []
FAMILY = {"alchemy", "hermetic", "rosicrucian", "theosophy"}
try:
    occ = json.load(open(OCC_CATALOG, encoding="utf-8"))
    groups = defaultdict(list)
    meta = {}
    idx = 0
    for it in occ["items"]:
        if it.get("tradition") not in FAMILY: continue
        if it.get("work_key") == "atalanta_fugiens": continue  # dedupe — already our main set
        card = it.get("card")
        if not card: continue
        wk = it.get("work_key") or "misc"
        meta[wk] = {"label": it.get("work") or wk, "creator": it.get("creator") or "", "tradition": it.get("tradition")}
        pid = "occ-" + it["id"]
        item = {"id": pid, "book": "occult", "title": it.get("title") or it["id"],
                "img": "/OCCULTIMGDB/site/" + card, "work": it.get("work") or wk,
                "tradition": it.get("tradition"), "date": it.get("date") or ""}
        groups[wk].append(item)
        text = " ".join(str(it.get(k, "")) for k in ("title", "work", "motifs", "key_concepts", "summary"))
        pmap[pid] = proc_from_text(text, idx); idx += 1
    for wk, items in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        m = meta[wk]
        collections.append({"key": "occ_" + wk, "label": m["label"],
                            "sub": f"{m['creator']} · {m['tradition']}".strip(" ·"),
                            "group": "occult", "items": items})
except Exception as e:
    print("warn: OCCULTIMGDB:", e)

# ---------- TheosophicalAlchemyDB (adept figures) ----------
tad_items = []
tdir = os.path.join(DEV, TAD_FIGS)
if os.path.isdir(tdir):
    seen = set()
    for f in sorted(os.listdir(tdir)):
        if not re.search(r"\.(jpg|jpeg|png|webp)$", f, re.I): continue
        stem = re.sub(r"\.(jpg|jpeg|png|webp)$", "", f, flags=re.I)
        if stem in seen: continue  # prefer first ext
        seen.add(stem)
        name = stem.replace("-", " ").title()
        pid = "tad-" + stem
        tad_items.append({"id": pid, "book": "occult", "title": name + " — adept", "img": f"/{TAD_FIGS}/{f}", "work": "Theosophical Alchemy — Adepts", "tradition": "theosophy", "date": ""})
        pmap[pid] = "digestion"
    if tad_items:
        collections.append({"key": "tad_adepts", "label": "Theosophical Alchemy — Adepts",
                            "sub": "Portraits of the philosophers · TheosophicalAlchemyDB",
                            "group": "occult", "items": tad_items})

occult_count = sum(len(c["items"]) for c in collections)
counts = {"atalanta": len(af), "hypnerotomachia": len(hp), "occult": occult_count,
          "total": len(af) + len(hp) + occult_count}

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("// AUTO-GENERATED by tools/gen_catalog.py — do not edit by hand.\n")
    fh.write("export const CATALOG = " + json.dumps({"atalanta": af, "hypnerotomachia": hp, "collections": collections}, ensure_ascii=False) + ";\n")
    fh.write("export const COUNTS = " + json.dumps(counts) + ";\n")

with open(PMAP_OUT, "w", encoding="utf-8") as fh:
    fh.write("// AUTO-GENERATED by tools/gen_catalog.py — plate id -> process key.\n")
    fh.write("export const PROCESS_MAP = " + json.dumps(pmap, ensure_ascii=False) + ";\n")

print(f"catalog: atalanta={len(af)} hypnerotomachia={len(hp)} occult={occult_count} ({len(collections)} collections) total={counts['total']}")
print("process map entries:", len(pmap))

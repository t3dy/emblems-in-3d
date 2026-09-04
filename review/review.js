// ===========================================================================
// review.js — the accept / reject / note loop for the Phase 5 reconstructions.
//
// One item per plate. Each shows, in order: the perspective solve drawn back
// onto the engraving, the live reconstruction in an iframe, and the element
// table. Every control writes to disk immediately through review/serve.py —
// and the element-kind and horizon controls write into the SAME override files
// the pipeline reads, so a correction made here changes the next build rather
// than accumulating in a browser profile.
// ===========================================================================

const $ = (s, r = document) => r.querySelector(s);
const el = (t, cls, txt) => { const n = document.createElement(t); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const KINDS = ["standing", "attached", "architecture", "ornament", "furniture"];
const KIND_HELP = {
  standing: "touches the ground plane — becomes a card at its contact depth",
  attached: "painted or inscribed on a surface — becomes a decal, never a free card",
  architecture: "part of the space itself — built, or left reading on the backdrop",
  ornament: "an engraver's convention (cloud-scrolls) — no depth, ever",
  furniture: "binding, gutter, letterpress — not part of the picture at all",
};

const [PERSP, ELEMS, DECISIONS] = await Promise.all([
  fetch("../data/perspective.json").then((r) => r.json()),
  fetch("../data/elements.json").then((r) => r.json()),
  fetch("/api/decisions").then((r) => r.json()),
]);

const KEYS = Object.keys(PERSP).sort();
const WORKED = new Set(["emblem-01", "emblem-08", "emblem-21"]);
let filter = "all";
let selected = null;

// --------------------------------------------------------------------- api --
async function post(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function flash(node, text, ok = true) {
  node.textContent = text;
  node.style.color = ok ? "var(--good)" : "var(--bad)";
  clearTimeout(node._t);
  node._t = setTimeout(() => (node.textContent = ""), 3200);
}

// ---------------------------------------------------------- figure marking --
const FIG_COLOURS = ["#e0a020", "#20a0e0", "#40b060", "#c060c0", "#e06040"];

/** Homogeneous meet of the line through two heads and the line through two feet. */
function meetOfPair(a, b) {
  const L = (p, q) => [p[1] - q[1], q[0] - p[0], p[0] * q[1] - p[1] * q[0]];
  const tops = L(a.head, b.head), bases = L(a.foot, b.foot);
  const w = tops[0] * bases[1] - tops[1] * bases[0];
  if (Math.abs(w) < 1e-12) return null;
  return [(tops[1] * bases[2] - tops[2] * bases[1]) / w,
          (tops[2] * bases[0] - tops[0] * bases[2]) / w];
}

function previewHorizon(figs) {
  const pts = [];
  for (let i = 0; i < figs.length; i++)
    for (let j = i + 1; j < figs.length; j++) {
      const m = meetOfPair(figs[i], figs[j]);
      if (m) pts.push(m);
    }
  if (!pts.length) return null;
  if (pts.length === 1) return { ny: pts[0][1], slope: 0, pts };
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  const sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  const b = my - slope * mx;
  const resid = Math.max(...pts.map((p) => Math.abs(p[1] - (slope * p[0] + b))));
  return { ny: slope * 0.5 + b, slope, pts, resid };
}

async function setupFigureMarking(key) {
  const wrap = $("#figwrap"), img = $("#figimg"), cv = $("#figcv");
  if (!wrap) return;
  let pending = null;                  // a head waiting for its foot
  let figs = [];

  try {
    const store = await fetch("/api/figures").then((r) => r.json());
    if (store[key] && store[key].figures) figs = store[key].figures.map((f) => ({ ...f }));
    if (store[key] && store[key].verified) $("#figver").checked = true;
  } catch (e) { /* first run, no file yet */ }

  function draw() {
    const r = img.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width));
    cv.height = Math.max(1, Math.round(r.height));
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, cv.height);
    const X = (nx) => nx * cv.width, Y = (ny) => ny * cv.height;

    figs.forEach((f, i) => {
      const c = FIG_COLOURS[i % FIG_COLOURS.length];
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X(f.head[0]), Y(f.head[1])); g.lineTo(X(f.foot[0]), Y(f.foot[1])); g.stroke();
      for (const p of [f.head, f.foot]) {
        g.beginPath(); g.arc(X(p[0]), Y(p[1]), 5, 0, 7); g.fill();
      }
      g.font = "12px system-ui";
      g.fillText(f.name || ("figure " + (i + 1)), X(f.head[0]) + 8, Y(f.head[1]) - 6);
    });

    if (pending) {
      g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 1;
      g.beginPath(); g.arc(X(pending[0]), Y(pending[1]), 5, 0, 7); g.fill(); g.stroke();
    }

    if (figs.length >= 2) {
      const h = previewHorizon(figs);
      if (h) {
        // the head and foot lines that produced the meets, faintly
        g.strokeStyle = "rgba(255,200,0,.35)"; g.lineWidth = 1;
        for (let i = 0; i < figs.length; i++)
          for (let j = i + 1; j < figs.length; j++)
            for (const k of ["head", "foot"]) {
              g.beginPath();
              g.moveTo(X(figs[i][k][0]), Y(figs[i][k][1]));
              g.lineTo(X(figs[j][k][0]), Y(figs[j][k][1]));
              g.stroke();
            }
        g.strokeStyle = "rgba(255,190,0,.95)"; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, Y(h.ny - h.slope * 0.5));
        g.lineTo(cv.width, Y(h.ny + h.slope * 0.5));
        g.stroke();

        const cut = figs.map((f) => (f.foot[1] - h.ny) / (f.foot[1] - f.head[1]));
        $("#figreadout").innerHTML =
          "horizon <b>ny " + h.ny.toFixed(4) + "</b> \u00b7 tilt " +
          (Math.atan(h.slope) * 180 / Math.PI).toFixed(2) + "\u00b0 \u00b7 " +
          figs.length + " figures, " + h.pts.length + " pair meet" +
          (h.pts.length === 1 ? "" : "s") +
          (h.resid != null ? " \u00b7 largest residual " + h.resid.toFixed(4)
                           : " \u00b7 one meet, tilt assumed level") +
          "<br>the horizon cuts the figures at " + cut.map((c) => c.toFixed(3)).join(", ") +
          " of their height (these should agree; if they do not, the figures are not the " +
          "same height, or not on one ground plane, and the plate is telling you so)";
      }
    } else {
      $("#figreadout").textContent = figs.length === 1
        ? "one figure marked \u2014 the construction needs at least two"
        : "";
    }
  }

  wrap.onclick = (ev) => {
    const r = img.getBoundingClientRect();
    const nx = (ev.clientX - r.left) / r.width, ny = (ev.clientY - r.top) / r.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
    if (!pending) { pending = [nx, ny]; }
    else {
      const head = pending[1] <= ny ? pending : [nx, ny];
      const foot = pending[1] <= ny ? [nx, ny] : pending;
      figs.push({ name: "figure " + (figs.length + 1), head, foot });
      pending = null;
    }
    draw();
  };
  $("#figundo").onclick = () => { if (pending) pending = null; else figs.pop(); draw(); };
  $("#figclear").onclick = () => { figs = []; pending = null; draw(); };

  async function send(commit) {
    try {
      const j = await post("/api/figures", {
        key, figures: figs, verified: $("#figver").checked, commit,
      });
      const s = j.solve || {};
      flash($("#figsaved"), s.ok
        ? figs.length + " figures saved \u00b7 horizon ny " + s.horizon_ny.toFixed(4) +
          (commit ? " \u2014 written to the overrides; re-run solve_perspective.py" : "")
        : "saved, but no horizon: " + s.why, !!s.ok);
    } catch (e) { flash($("#figsaved"), e.message, false); }
  }
  $("#figsave").onclick = () => send(false);
  $("#figcommit").onclick = () => send(true);

  if (img.complete) draw(); else img.onload = draw;
  addEventListener("resize", draw);
}

// -------------------------------------------------------------------- list --
function statusOf(key) { return (DECISIONS[key] || {}).status || "unreviewed"; }

function renderList() {
  const list = $("#list");
  list.textContent = "";
  for (const key of KEYS) {
    const st = statusOf(key);
    if (filter === "unreviewed" && st !== "unreviewed") continue;
    if (filter === "reviewed" && st === "unreviewed") continue;
    const row = el("div", "item" + (key === selected ? " sel" : ""));
    row.append(el("span", "dot " + st));
    const n = el("span", null, key.replace("emblem-", "Emblem "));
    row.append(n);
    if (WORKED.has(key)) row.append(el("span", "badge good", "worked"));
    else if (PERSP[key].reviewed) row.append(el("span", "badge good", "reviewed"));
    else if ((PERSP[key].confidence || 0) < 0.25) row.append(el("span", "badge weak", "weak"));
    row.onclick = () => select(key);
    list.append(row);
  }
  const counts = KEYS.reduce((a, k) => (a[statusOf(k)] = (a[statusOf(k)] || 0) + 1, a), {});
  $("#progress").textContent =
    `${counts.accepted || 0} accepted · ${counts.rejected || 0} rejected · ` +
    `${counts.noted || 0} noted · ${counts.unreviewed || 0} to do`;
}

// ------------------------------------------------------------------ detail --
function select(key) {
  selected = key;
  renderList();
  const p = PERSP[key];
  const elements = (ELEMS[key] || { elements: [] }).elements;
  const d = DECISIONS[key] || {};
  const box = $("#detail");

  const measured = !String(p.focal_basis || "").startsWith("ASSUMED");
  box.innerHTML = `
    <h1 style="margin:0 0 4px;font-size:26px">${esc(key.replace("emblem-", "Emblem "))}
      <span class="badge ${p.reviewed ? "good" : (p.confidence >= 0.25 ? "" : "weak")}">
        ${p.reviewed ? "hand-reviewed solve" : "auto solve · conf " + p.confidence}</span>
      ${WORKED.has(key) ? '<span class="badge good">worked example</span>' : ""}
    </h1>
    <p class="fine" style="margin:0 0 14px">
      ${esc(p.type)} · horizon ny ${p.horizon_ny} · f ${p.focal_px} px (${measured ? "measured" : "assumed"})
      · station eye ${p.eye_height_m} m
    </p>

    <div class="rev-actions">
      <button class="btn" id="acc">Accept</button>
      <button class="btn" id="rej">Reject</button>
      <button class="btn" id="note-only">Save note only</button>
      <span class="saved" id="saved"></span>
    </div>
    <textarea class="note" id="note" placeholder="Notes — what is wrong, what to change, what you want next.">${esc(d.note || "")}</textarea>

    <h2>1 · The perspective solve, drawn back onto the plate</h2>
    <p class="fine">Yellow is the recovered horizon and vanishing point. Green ticks are
      the ground-contact points every depth is computed from; pale ticks are low-confidence
      contacts. On an auto-solved plate the cyan and orange segments are the lines that
      voted for the vanishing point.</p>
    <div class="rev-figure"><img src="../site/assets/solve/${key}.jpg" alt="solve overlay for ${key}" /></div>

    <div class="rev-actions">
      <label class="fine">horizon ny
        <input id="hy" type="number" step="0.005" min="0.02" max="0.98" value="${p.horizon_ny}"
               style="width:90px;font:inherit;padding:3px 6px;border:1px solid var(--rule);border-radius:4px;background:var(--paper);color:var(--ink)" />
      </label>
      <button class="btn" id="sethy">Set horizon</button>
      <span class="fine">writes to data/perspective.overrides.json — then re-run
        <code>python tools/solve_perspective.py</code></span>
    </div>

    <h2>1b · Or mark the people, and let the construction find the horizon</h2>
    <p class="fine">For two or more figures of about the same height standing on the same
      ground, the line through their heads and the line through their feet meet on the
      horizon — <em>with no assumption about how tall anyone is</em> (Criminisi, Reid &amp;
      Zisserman, <em>Single View Metrology</em>, 2000). This is the estimator the landscape
      and wall plates need, and the reason it was unusable is that the extractor finds five
      figures in fifty-one plates. Marking them by hand is the way round that.</p>
    <p class="fine"><b>Click the top of a head, then that figure's foot on the ground.</b>
      Repeat for the next figure. Three or more figures over-determine the horizon and the
      residual becomes a real error bar.</p>
    <div class="rev-figure" id="figwrap" style="position:relative;cursor:crosshair">
      <img id="figimg" src="../site/assets/plates/${key}.jpg" alt="plate ${key}" style="display:block;width:100%" />
      <canvas id="figcv" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    </div>
    <div class="rev-actions">
      <button class="btn" id="figundo">Undo point</button>
      <button class="btn" id="figclear">Clear</button>
      <label class="fine"><input type="checkbox" id="figver" /> I checked these against the grid</label>
      <button class="btn" id="figsave">Save marks</button>
      <button class="btn" id="figcommit">Save + set horizon</button>
      <span class="saved" id="figsaved"></span>
    </div>
    <p class="fine" id="figreadout"></p>

    <h2>2 · The reconstruction, live</h2>
    <p class="fine">Press the gate button inside the frame twice for the inverted overlay:
      flat grey means the reconstruction registers with the engraving.</p>
    <div class="rev-figure">
      <iframe src="../site/reconstruct.html?id=${key}" title="reconstruction of ${key}"></iframe>
    </div>

    <h2>3 · Elements <span class="fine">(${elements.length})</span></h2>
    <p class="fine">Kind decides what an element becomes. Changing it writes to
      data/elements.overrides.json — then re-run <code>python tools/build_elements.py</code>.</p>
    <div class="scroll-x"><table class="data" id="etable">
      <thead><tr><th>cutout</th><th>label</th><th>kind</th><th title="Cutouts of things that stood behind something else come out with holes — the engraver never drew what the figure was covering. Tick to queue that hole for an AI fill; the fill is kept as its own labelled layer, never painted into the source.">AI fill</th><th>contact</th><th>depth</th><th>score</th></tr></thead>
      <tbody></tbody>
    </table></div>

    ${p.notes ? `<h2>Solver / reviewer notes</h2><p class="fine">${esc(p.notes)}</p>` : ""}
    ${p.metric_anomaly ? `<h2>Recorded anomaly</h2><p class="fine">${esc(p.metric_anomaly)}</p>` : ""}
  `;

  // --- figure marking -----------------------------------------------------
  // Two clicks make a figure: head, then foot. The preview construction here is
  // the same one review/serve.py runs on save; the server stays authoritative,
  // this is only so the horizon appears while you are still marking.
  setupFigureMarking(key);

  // --- element rows -------------------------------------------------------
  const tb = $("#etable tbody");
  const F = p.focal_px, EYE = p.eye_height_m || 1.6, YH = p.horizon_y;
  for (const e of elements) {
    const tr = el("tr");
    const img = el("img");
    img.src = `../site/assets/cutouts/${e.file}`;
    img.style.cssText = "height:44px;width:auto;background:var(--paper);border:1px solid var(--rule);border-radius:3px";
    const td0 = el("td"); td0.append(img); tr.append(td0);
    tr.append(el("td", null, e.label || "—"));

    const sel = el("select");
    sel.style.cssText = "font:inherit;font-size:13px;padding:3px 5px;border:1px solid var(--rule);border-radius:4px;background:var(--paper);color:var(--ink)";
    for (const k of KINDS) {
      const o = el("option", null, k);
      o.value = k; if (k === e.kind) o.selected = true;
      sel.append(o);
    }
    sel.title = KIND_HELP[e.kind] || "";
    sel.onchange = async () => {
      try {
        await post("/api/element-kind", { file: e.file, kind: sel.value });
        e.kind = sel.value;
        sel.title = KIND_HELP[sel.value];
        flash($("#saved"), `saved ${e.label || e.file} → ${sel.value} (re-run build_elements.py)`);
      } catch (err) { flash($("#saved"), err.message, false); }
    };
    const td2 = el("td"); td2.append(sel);
    if (!e.kind_reviewed) td2.append(el("span", "badge weak", " guessed"));
    tr.append(td2);

    // --- "fill in with AI later" -------------------------------------------
    // Pre-ticked for elements the extractor already knows have occlusion holes
    // (something stood in front of them), so the common case is one glance
    // rather than one click per card.
    const tdF = el("td");
    const cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!e.needs_ai_fill;
    cb.title = e.occluded_by && e.occluded_by.length
      ? `hole left by: ${e.occluded_by.join(", ")}`
      : "no occlusion hole detected — tick only if something else is missing";
    cb.onchange = async () => {
      try {
        await post("/api/ai-fill", {
          file: e.file, needs_ai_fill: cb.checked, note: $("#note").value || "",
        });
        e.needs_ai_fill = cb.checked;
        flash($("#saved"), `${e.label || e.file}: AI fill ${cb.checked ? "queued" : "cleared"}`);
      } catch (err) { cb.checked = !cb.checked; flash($("#saved"), err.message, false); }
    };
    tdF.append(cb);
    if (e.occluded_frac) {
      tdF.append(el("div", "fine", `${Math.round(e.occluded_frac * 100)}% hidden`));
    }
    tr.append(tdF);

    const cc = e.contact_confidence;
    const tdc = el("td");
    tdc.append(el("span", "badge " + (cc >= 0.6 ? "good" : cc >= 0.3 ? "weak" : "bad"), cc.toFixed(2)));
    tdc.append(el("div", "fine", e.contact_basis));
    tr.append(tdc);

    const z = e.contact_y > YH ? (F * EYE) / (e.contact_y - YH) : Infinity;
    tr.append(el("td", "num", isFinite(z) ? z.toFixed(2) + " m" : "at horizon"));
    tr.append(el("td", "num", e.score ? e.score.toFixed(2) : "—"));
    tb.append(tr);
  }

  // --- actions ------------------------------------------------------------
  const saveDecision = async (status) => {
    try {
      const j = await post("/api/decisions", { key, status, note: $("#note").value });
      DECISIONS[key] = j.entry;
      renderList();
      flash($("#saved"), `saved: ${status}`);
    } catch (err) { flash($("#saved"), err.message, false); }
  };
  $("#acc").onclick = () => saveDecision("accepted");
  $("#rej").onclick = () => saveDecision("rejected");
  $("#note-only").onclick = () => saveDecision($("#note").value.trim() ? "noted" : "unreviewed");

  $("#sethy").onclick = async () => {
    try {
      const j = await post("/api/horizon", {
        key, horizon_ny: parseFloat($("#hy").value), note: $("#note").value || undefined,
      });
      flash($("#saved"), `horizon set to ${j.horizon_ny} — re-run ${j.rerun}`);
    } catch (err) { flash($("#saved"), err.message, false); }
  };
}

// --------------------------------------------------------------------- go ---
for (const b of document.querySelectorAll("[data-filter]")) {
  b.onclick = () => { filter = b.dataset.filter; renderList(); };
}
renderList();
select(KEYS.includes("emblem-08") ? "emblem-08" : KEYS[0]);

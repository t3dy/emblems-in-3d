// ===========================================================================
// tour.js — the shared "lab process tour" panel. Given a process (from
// processes.js) it lays out what the operation is, the bench steps, the
// apparatus, the degree of fire, and which laboratory it belongs to, with a
// button to visit that lab. Used by both the gallery and the scene pages.
// ===========================================================================
import { PROCESSES, SPECIALIZED_LABS } from "./processes.js";

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function makeTour({ onVisitLab } = {}) {
  const panel = el("div", "tour-panel");
  panel.innerHTML = `
    <div class="tour-head">
      <span class="tour-kicker">Lab process tour</span>
      <button class="tour-close" title="Close (Esc)">✕</button>
    </div>
    <div class="tour-body"></div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector(".tour-body");
  let open = false;

  function render(proc, plateTitle) {
    const labDef = SPECIALIZED_LABS[proc.lab];
    const labLine = proc.lab === "base"
      ? `Performed in <b>our base laboratory</b> (athanor, crucible, balneum).`
      : `Needs the <b>${proc.lab}</b> — ${labDef ? labDef.why : "a purpose-built lab beyond our base bench."}`;
    body.innerHTML = `
      ${plateTitle ? `<p class="tour-plate">${plateTitle}</p>` : ""}
      <h2>${proc.name}${proc.gate ? ` <span class="tour-gate">· Ripley's gate of ${proc.gate}</span>` : ""}</h2>
      <p class="tour-summary">${proc.summary}</p>
      <div class="tour-meta">
        <span>🔥 ${proc.heat}</span>
        ${proc.color ? `<span class="tour-color tour-${proc.color}">${proc.color}</span>` : ""}
      </div>
      <p class="tour-label">At the bench</p>
      <ol class="tour-steps">${proc.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
      <p class="tour-label">Apparatus</p>
      <p class="tour-app">${proc.apparatus.map((a) => `<span>${a}</span>`).join("")}</p>
      <p class="tour-lab">${labLine}</p>
      <button class="tour-visit">${proc.lab === "base" ? "Enter the base laboratory ▸" : `Enter the ${proc.lab} ▸`}</button>
      <p class="tour-cite">${proc.cite}</p>`;
    body.querySelector(".tour-visit").onclick = () => onVisitLab && onVisitLab(proc.lab, proc);
  }

  panel.querySelector(".tour-close").onclick = () => api.close();
  addEventListener("keydown", (e) => { if (e.key === "Escape" && open) api.close(); });

  const api = {
    get isOpen() { return open; },
    openProcess(procKey, plateTitle) {
      const proc = PROCESSES[procKey];
      if (!proc) return;
      render(proc, plateTitle);
      open = true; panel.classList.add("show");
    },
    close() { open = false; panel.classList.remove("show"); },
  };
  return api;
}

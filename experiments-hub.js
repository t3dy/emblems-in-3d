import { EXPERIMENTS } from "./experiments.js";

const grid = document.getElementById("lab-grid");
for (const e of EXPERIMENTS) {
  const a = document.createElement("a");
  a.className = "lab-card";
  a.href = `experiment.html?id=${e.id}`;
  a.innerHTML =
    `<div class="lab-thumb"><img loading="lazy" src="${e.thumb}" alt="">` +
    `<span class="lab-kind">${e.kind}</span></div>` +
    `<div class="lab-meta">` +
    `<h2>${e.title}</h2>` +
    `<p class="lab-emblem">Emblem ${e.emblem}</p>` +
    `<p class="lab-preview">${e.preview}</p>` +
    `<p class="lab-tags">${(e.tags || []).map((t) => `<span>${t}</span>`).join("")}</p>` +
    `<span class="lab-open">Open the experiment ▸</span>` +
    `</div>`;
  grid.appendChild(a);
}

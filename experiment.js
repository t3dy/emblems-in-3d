import { EXP_BY_ID } from "./experiments.js";
import { ChipPlayer } from "./chiptune.js";

const id = new URLSearchParams(location.search).get("id") || "regulated-fire";
const exp = EXP_BY_ID[id] || Object.values(EXP_BY_ID)[0];

document.title = `${exp.title} — Alchemical Experiment`;
document.getElementById("x-kind").textContent = `${exp.kind} · Emblem ${exp.emblem}`;
document.querySelector(".x-eyebrow").textContent = `${exp.kind.toUpperCase()} · EMBLEM ${exp.emblem}`;
document.getElementById("x-title").textContent = exp.title;
document.querySelector(".x-lede").textContent = exp.preview;
document.getElementById("x-body").innerHTML = exp.essay;
document.getElementById("x-stagehint").textContent = (exp.tags || []).join("  ·  ");
document.querySelector(".x-links").innerHTML =
  `<a href="gallery.html">⊞ all plates</a> · ` +
  (exp.emblemN ? `<a href="scene.html?id=af-${String(exp.emblemN).padStart(2,"0")}">walk emblem ${exp.emblem} ▸</a> · ` : "") +
  `<a href="experiments.html">more experiments ▸</a>`;

// mount the artifact (Canvas2D module under art/<id>.js)
let art = null;
import(`./art/${exp.id}.js`)
  .then((mod) => { art = mod.mount(document.getElementById("artifact"), {}); window.EXP = { art, exp }; })
  .catch((e) => { document.getElementById("artifact").innerHTML = `<p style="color:#9c8e6e;padding:2rem">This experiment's artifact failed to load.<br><small>${e}</small></p>`; });

// optional: play the associated emblem's fugue (NES chiptune) for ambience
const chip = new ChipPlayer();
let playing = false;
document.getElementById("x-fugue").onclick = async (e) => {
  if (!exp.emblemN) return;
  if (!playing) { await chip.load(); chip.resume(); chip.playEmblem(exp.emblemN, true); playing = true; e.target.textContent = "♪ stop fugue"; }
  else { chip.stop(); playing = false; e.target.textContent = "♪ play this emblem's fugue"; }
};

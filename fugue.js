import { EMBLEMDATA } from "./emblemdata.js";
import { EXPLAIN } from "./emblem_explanations.js";
import { GAME_PALETTES } from "./gamesynths.js";
import { ChipPlayer } from "./chiptune.js";

// ===========================================================================
// fugue.js — the per-emblem fugue page. Plays the emblem's fugue cycling through
// the ten NES game palettes as it repeats; shows the accordion explanation
// (short → deep, from the Claudiens DB) and a synth-credits appendix.
// ===========================================================================

const n = Math.max(1, Math.min(50, parseInt(new URLSearchParams(location.search).get("n") || "8", 10)));
const d = EMBLEMDATA[String(n)] || {};
const ex = EXPLAIN[String(n)] || {};

const AF_IMG = (k) => `/EmblemPrintShop/sources/claudiens/site/images/emblems/emblem-${String(k).padStart(2,"0")}.jpg`;
document.title = `Emblem ${d.roman || n} — Fugue`;
document.getElementById("fg-plate").src = AF_IMG(n);
document.getElementById("fg-eyebrow").textContent = `ATALANTA FUGIENS · FUGUE ${d.roman || n}`;
document.getElementById("fg-title").textContent = `Emblem ${d.roman || n}`;
document.getElementById("fg-motto").textContent = d.mottoEn || ex.motto || "";
document.getElementById("fg-kind").textContent = `${GAME_PALETTES.length} versions · one per game`;
document.getElementById("fg-short").innerHTML = ex.short || "(no summary on record)";
document.getElementById("fg-deep").innerHTML = ex.deep || "";
document.getElementById("fg-prev").href = `fugue.html?n=${n > 1 ? n - 1 : 50}`;
document.getElementById("fg-next").href = `fugue.html?n=${n < 50 ? n + 1 : 1}`;

// synth credits
const creditsEl = document.getElementById("fg-credits");
GAME_PALETTES.forEach((p, i) => {
  const row = document.createElement("div");
  row.className = "credit"; row.id = `cr-${i}`;
  row.innerHTML = `<div class="num">${i + 1}</div><div><div class="g">${p.game} <span class="l">· ${p.level}</span></div><div class="b">${p.blurb}</div></div>`;
  creditsEl.appendChild(row);
});

// ---- player ----
const chip = new ChipPlayer();
let loaded = false, playing = false, muted = false, curIdx = 0;
const verEl = document.querySelector("#fg-now .ver");
const glEl = document.querySelector("#fg-now .gl");
const blEl = document.querySelector("#fg-now .bl");

function onPalette(idx, pal) {
  curIdx = idx;
  verEl.textContent = `Version ${idx + 1} of ${GAME_PALETTES.length}`;
  glEl.textContent = `${pal.game} — ${pal.level}`;
  blEl.textContent = pal.blurb;
  document.querySelectorAll(".credit").forEach((c, i) => c.classList.toggle("on", i === idx));
}

const playBtn = document.getElementById("fg-play");
playBtn.onclick = async () => {
  if (!playing) {
    if (!loaded) { await chip.load(); loaded = true; }
    chip.resume();
    chip.playEmblem(n, { loop: true, palettes: GAME_PALETTES, startPalette: curIdx, onPalette });
    playing = true; playBtn.textContent = "⏸ pause";
  } else { chip.stop(); playing = false; playBtn.textContent = "▸ play"; }
};
document.getElementById("fg-skip").onclick = () => { if (playing) chip.nextPalette(); };
document.getElementById("fg-mute").onclick = (e) => { muted = !muted; chip.setMuted(muted); e.target.textContent = muted ? "♪ muted" : "♪ on"; };

// spectrum visualizer, tinted by alchemical stage
const STAGE_COLOR = { NIGREDO: "#6878a0", ALBEDO: "#d6dce8", CITRINITAS: "#ffd86a", RUBEDO: "#ff6a44" };
const viz = document.getElementById("fg-viz"), vctx = viz.getContext("2d");
function drawViz() {
  requestAnimationFrame(drawViz);
  vctx.fillStyle = "#0c0a07"; vctx.fillRect(0, 0, viz.width, viz.height);
  if (!chip.analyser) return;
  const buf = new Uint8Array(chip.analyser.frequencyBinCount); chip.analyser.getByteFrequencyData(buf);
  const col = STAGE_COLOR[d.stage] || "#caa45a", bars = 32, step = Math.floor(buf.length / bars);
  for (let i = 0; i < bars; i++) {
    let v = 0; for (let k = 0; k < step; k++) v += buf[i * step + k]; v = v / step / 255;
    const h = Math.max(1, v * viz.height);
    vctx.fillStyle = col; vctx.globalAlpha = 0.3 + v * 0.7;
    vctx.fillRect(i * (viz.width / bars) + 1, viz.height - h, viz.width / bars - 2, h);
  }
  vctx.globalAlpha = 1;
}
drawViz();

window.FUGUE = { chip, n, playToggle: () => playBtn.onclick(), palettes: GAME_PALETTES.length, current: () => curIdx };

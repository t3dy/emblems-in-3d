import { CATALOG } from "./catalog.js";
import { EMBLEMDATA } from "./emblemdata.js";
import { ChipPlayer } from "./chiptune.js";

// ===========================================================================
// jukebox.js — play any of Maier's 50 fugues rendered through the NES-APU
// chiptune engine, with an 8-bit spectrum visualizer.
// ===========================================================================

const grid = document.getElementById("jb-grid");
const nowT = document.querySelector("#jb-now .t");
const nowS = document.querySelector("#jb-now .s");
const viz = document.getElementById("jb-viz");
const vctx = viz.getContext("2d");

const chip = new ChipPlayer();
let loaded = false, playing = null, muted = false;
const STAGE_OF = (n) => (EMBLEMDATA[String(n)] || {}).stage || "";

// grid of the 50 emblems (skip frontispiece 0)
const byN = {}; CATALOG.atalanta.forEach((e) => (byN[e.n] = e));
for (let n = 1; n <= 50; n++) {
  const e = byN[n]; if (!e) continue;
  const d = EMBLEMDATA[String(n)] || {};
  const c = document.createElement("button");
  c.className = "jb-card"; c.dataset.n = n;
  c.innerHTML =
    `<div class="jb-thumb"><img loading="lazy" decoding="async" src="${e.img}" alt=""></div>` +
    `<div class="jb-cap"><div class="r">EMBLEM ${d.roman || n}</div>` +
    `<div class="m">${d.mottoEn || e.title}</div><div class="st">${(d.stage || "").toLowerCase()}</div></div>`;
  c.addEventListener("click", () => (location.href = `fugue.html?n=${n}`)); // open the full fugue page (10 cycling versions + essay)
  grid.appendChild(c);
}

async function ensure() { if (!loaded) { await chip.load(); loaded = true; } chip.resume(); }

async function playN(n) {
  await ensure();
  if (!chip.playEmblem(n, true)) { nowT.textContent = `Emblem ${n} — no fugue data`; return; }
  playing = n;
  document.querySelectorAll(".jb-card").forEach((c) => c.classList.toggle("playing", +c.dataset.n === n));
  const d = EMBLEMDATA[String(n)] || {};
  nowT.textContent = `Emblem ${d.roman || n} — ${d.mottoEn || ""}`;
  nowS.textContent = `${STAGE_OF(n).toLowerCase()} · ${Math.round((chip.fugues[String(n)] || {}).bpm || 0)} bpm · three-voice canon`;
}

document.getElementById("jb-stop").onclick = () => { chip.stop(); playing = null; document.querySelectorAll(".jb-card").forEach((c) => c.classList.remove("playing")); nowT.textContent = "— stopped —"; };
document.getElementById("jb-mute").onclick = (e) => { muted = !muted; chip.setMuted(muted); e.target.textContent = muted ? "♪ muted" : "♪ on"; };

// 8-bit spectrum visualizer
const STAGE_COLOR = { NIGREDO: "#6878a0", ALBEDO: "#d6dce8", CITRINITAS: "#ffd86a", RUBEDO: "#ff6a44" };
function drawViz() {
  requestAnimationFrame(drawViz);
  vctx.fillStyle = "#0c0a07"; vctx.fillRect(0, 0, viz.width, viz.height);
  if (!chip.analyser) return;
  const a = chip.analyser;
  const buf = new Uint8Array(a.frequencyBinCount);
  a.getByteFrequencyData(buf);
  const col = STAGE_COLOR[STAGE_OF(playing)] || "#caa45a";
  const bars = 24, step = Math.floor(buf.length / bars);
  for (let i = 0; i < bars; i++) {
    let v = 0; for (let k = 0; k < step; k++) v += buf[i * step + k];
    v = v / step / 255;
    const h = Math.max(1, v * viz.height);
    vctx.fillStyle = col;
    vctx.globalAlpha = 0.35 + v * 0.65;
    vctx.fillRect(i * (viz.width / bars) + 1, viz.height - h, viz.width / bars - 2, h);
  }
  vctx.globalAlpha = 1;
}
drawViz();

window.JUKE = { chip, playN, get playing() { return playing; }, loaded: () => loaded };

import { EMBLEMDATA } from "../emblemdata.js";
import { GAME_PALETTES } from "../gamesynths.js";
import { EXPLAIN } from "../emblem_explanations.js";

const $ = (id) => document.getElementById(id);
const imgFor = (n) => `/EmblemPrintShop/sources/claudiens/site/images/emblems/emblem-${String(n).padStart(2, "0")}.jpg`;
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

const EXPERIMENTS = [
  {
    id: "levitating-athanor",
    name: "Levitating Athanor",
    short: "The fugue becomes furnace pressure. Bass notes pull the emblem plate upward, delayed echoes trail as vapor, and improvised upper tones behave like sparks that try to escape the vessel. The game is to keep the Work hovering in the middle band: click or tap to vent heat before the apparatus flips into excess.",
    verbs: ["hover", "vent", "cohere"],
  },
  {
    id: "ouroboric-dub",
    name: "Ouroboric Dub",
    short: "Every repeat feeds the fugue back into itself. Delay tails draw a circular serpent around the plate, and harmonized thirds become quicksilver beads that the serpent consumes. The emblem is interpreted as a loop machine: memory, appetite, and repetition make the form intelligent.",
    verbs: ["loop", "eat", "return"],
  },
  {
    id: "dewpoint-runner",
    name: "Dewpoint Runner",
    short: "Maier's calls to washing, dew, bath, and repeated cooking become a side-scrolling moisture game. Vibrato bends the horizon while the fugue's chord tones open gates of vapor. Move the cursor across the scene to collect dew before the next palette changes the rules.",
    verbs: ["wash", "rise", "fall"],
  },
  {
    id: "sword-egg-breakbeat",
    name: "Sword/Egg Breakbeat",
    short: "A fiery sword waits for the downbeat and cuts the visual field into impossible slices. Short envelopes turn canon entries into percussive arcade hits, while generated countermelodies draw fracture lines through the egg. The soundtrack makes the emblem's instruction literal: pierce only when the rhythm has prepared the shell.",
    verbs: ["strike", "crack", "hatch"],
  },
  {
    id: "rose-garden-lockstep",
    name: "Rose-Garden Lockstep",
    short: "The fugue is treated as a lock. Each game palette becomes a different key profile, and harmonized sequences rotate triangle, square, and circle gates in the garden wall. The visualization reads the emblematic call to action as access control: right relation opens the gate, brute force only decorates the outside.",
    verbs: ["align", "unlock", "enter"],
  },
  {
    id: "sublimation-pinball",
    name: "Sublimation Pinball",
    short: "Notes become charged pellets in a tilted alchemical cabinet. Delay repeats are bumpers, vibrato is gravity wobble, and improvised answering phrases kick the pellets back upward. The emblem becomes a playable model of ascent and return: volatility is useful only when the vessel keeps answering it.",
    verbs: ["launch", "ricochet", "ascend"],
  },
];

const TRANSFORMS = [
  { name: "Tape Delay Canon", delay: 0.18, feedback: 0.28, wet: 0.24, vib: 4, env: "rounded", harmony: [0, 7, 12], improv: "golden upper neighbor" },
  { name: "Mercury Vibrato", delay: 0.11, feedback: 0.18, wet: 0.16, vib: 22, env: "liquid", harmony: [0, 3, 7], improv: "chromatic shimmer" },
  { name: "Black Fire Gate", delay: 0.27, feedback: 0.38, wet: 0.32, vib: 8, env: "hard gated", harmony: [0, 5, 10], improv: "low pulse answers" },
  { name: "Albedo Wash", delay: 0.33, feedback: 0.22, wet: 0.36, vib: 13, env: "slow bloom", harmony: [0, 4, 9], improv: "falling dew figures" },
  { name: "Citrinitas Arp", delay: 0.14, feedback: 0.2, wet: 0.2, vib: 5, env: "plucked", harmony: [0, 4, 7, 12], improv: "clockwork arpeggios" },
  { name: "Rubedo Phaser", delay: 0.21, feedback: 0.31, wet: 0.3, vib: 17, env: "wide sustain", harmony: [0, 7, 11], improv: "red cadential flares" },
  { name: "Ouroboros Reverse", delay: 0.42, feedback: 0.44, wet: 0.38, vib: 11, env: "breathing", harmony: [0, -5, 7], improv: "tail-chasing echoes" },
  { name: "Salt Square Bass", delay: 0.09, feedback: 0.16, wet: 0.12, vib: 3, env: "square punch", harmony: [0, -12, 7], improv: "grounded ostinato" },
  { name: "Volatile Ladder", delay: 0.24, feedback: 0.34, wet: 0.34, vib: 28, env: "thin aerial", harmony: [0, 2, 9, 14], improv: "ascending escapes" },
  { name: "Projection Glitch", delay: 0.16, feedback: 0.5, wet: 0.42, vib: 35, env: "broken arcade", harmony: [0, 1, 6, 13], improv: "spark granules" },
];

class AntiGravPlayer {
  constructor(onEvent, onVersion) {
    this.onEvent = onEvent;
    this.onVersion = onVersion;
    this.fugues = {};
    this.ac = null;
    this.nodes = null;
    this.timer = null;
    this.notes = [];
    this.i = 0;
    this.start = 0;
    this.beat = 0.75;
    this.len = 24;
    this.version = 0;
    this.emblem = 8;
    this.muted = false;
  }

  async load() {
    const paths = [
      "/EmblemRoguelike/assets/fugues.json",
      "../assets/fugues.json",
      "fugues.json",
    ];
    for (const path of paths) {
      try {
        const res = await fetch(path);
        if (res.ok) {
          this.fugues = await res.json();
          return true;
        }
      } catch {}
    }
    return false;
  }

  ensure() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ac = new AC();
    const master = this.ac.createGain();
    const dry = this.ac.createGain();
    const delay = this.ac.createDelay(1.2);
    const fb = this.ac.createGain();
    const wet = this.ac.createGain();
    const filter = this.ac.createBiquadFilter();
    const analyser = this.ac.createAnalyser();
    filter.type = "lowpass";
    filter.frequency.value = 5200;
    analyser.fftSize = 512;
    master.gain.value = 0.58;
    dry.gain.value = 0.82;
    master.connect(dry);
    dry.connect(filter);
    master.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(filter);
    filter.connect(analyser);
    analyser.connect(this.ac.destination);
    this.nodes = { master, delay, fb, wet, filter, analyser };
  }

  setVersion(idx) {
    this.version = (idx + 10) % 10;
    const fx = TRANSFORMS[this.version];
    if (this.nodes) {
      const t = this.ac.currentTime;
      this.nodes.delay.delayTime.setTargetAtTime(fx.delay, t, 0.08);
      this.nodes.fb.gain.setTargetAtTime(fx.feedback, t, 0.08);
      this.nodes.wet.gain.setTargetAtTime(fx.wet, t, 0.08);
      this.nodes.filter.frequency.setTargetAtTime(3600 + this.version * 420, t, 0.12);
    }
    this.onVersion(this.version, GAME_PALETTES[this.version], fx);
  }

  play(emblem) {
    this.ensure();
    this.ac.resume();
    this.stop(false);
    const f = this.fugues[String(emblem)];
    if (!f) return false;
    this.emblem = emblem;
    this.notes = f.notes.slice().sort((a, b) => a[0] - b[0]);
    this.beat = 60 / (f.bpm || 75);
    this.len = (f.beats || this.notes.at(-1)[0] + this.notes.at(-1)[1]) * this.beat;
    this.i = 0;
    this.start = this.ac.currentTime + 0.12;
    this.setVersion(this.version);
    this.timer = setInterval(() => this.tick(), 25);
    return true;
  }

  stop(clear = true) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (clear) this.notes = [];
  }

  mute(m) {
    this.muted = m;
    if (this.nodes) this.nodes.master.gain.setTargetAtTime(m ? 0 : 0.58, this.ac.currentTime, 0.08);
  }

  next() {
    this.setVersion(this.version + 1);
  }

  tick() {
    const ahead = this.ac.currentTime + 0.22;
    while (this.i < this.notes.length) {
      const [b, dur, midi] = this.notes[this.i];
      const t = this.start + b * this.beat;
      if (t > ahead) break;
      this.voice(midi, t, Math.max(0.055, dur * this.beat), this.i);
      this.i++;
    }
    if (this.i >= this.notes.length && this.ac.currentTime > this.start + this.len - 0.2) {
      this.start += this.len;
      this.i = 0;
      this.setVersion(this.version + 1);
    }
  }

  voice(midi, t, dur, idx) {
    const pal = GAME_PALETTES[this.version];
    const fx = TRANSFORMS[this.version];
    const chord = fx.harmony;
    const pick = idx % chord.length;
    const extra = idx % 5 === 0 ? chord[(pick + 1) % chord.length] : null;
    this.tone(midi + chord[pick], t, dur, pal, fx, idx);
    if (extra !== null) this.tone(midi + extra + 12, t + dur * 0.42, dur * 0.42, pal, fx, idx + 99, 0.42);
    if (idx % 11 === 0) this.tone(midi + 12 + ((idx + this.version) % 7), t + 0.06, 0.09, pal, fx, idx + 199, 0.32);
    this.onEvent({ midi, t, dur, version: this.version, energy: Math.min(1, dur * 1.7), x: (idx * 37) % 1000 });
  }

  tone(midi, t, dur, pal, fx, idx, scale = 1) {
    const ac = this.ac;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    const cfg = midi < 54 ? pal.tri : (idx % 2 ? pal.p2 : pal.p1);
    osc.type = midi < 54 ? "triangle" : "square";
    osc.frequency.value = midiToFreq(midi);
    lfo.frequency.value = 4 + (idx % 5);
    lfoGain.gain.value = fx.vib * scale;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    const a = fx.env.includes("slow") ? 0.035 : 0.006;
    const r = fx.env.includes("gated") || fx.env.includes("punch") ? 0.035 : 0.11;
    const peak = (cfg.gain || 0.22) * 0.62 * scale;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.42), t + Math.min(dur * 0.72, dur - r));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.nodes.master);
    lfo.start(t);
    osc.start(t);
    lfo.stop(t + dur + 0.04);
    osc.stop(t + dur + 0.04);
  }

  level() {
    if (!this.nodes) return 0;
    const buf = new Uint8Array(this.nodes.analyser.frequencyBinCount);
    this.nodes.analyser.getByteFrequencyData(buf);
    let sum = 0;
    for (const v of buf) sum += v;
    return sum / (buf.length * 255);
  }
}

const state = {
  emblem: 8,
  experiment: EXPERIMENTS[0],
  events: [],
  mouse: { x: 0.5, y: 0.5, down: false },
  heat: 0.34,
  orbit: 0.48,
  mercury: 0.25,
  playing: false,
  loaded: false,
};

const canvas = $("world");
const ctx = canvas.getContext("2d");
const plateImg = new Image();
let currentVersion = 0;

const player = new AntiGravPlayer(
  (event) => {
    state.events.push({ ...event, born: performance.now(), life: 1800 + event.energy * 1200 });
    if (state.events.length > 220) state.events.splice(0, state.events.length - 220);
    state.heat = Math.min(1, state.heat + 0.01 + event.energy * 0.025);
    state.mercury = Math.min(1, state.mercury + 0.035);
  },
  (idx, pal, fx) => {
    currentVersion = idx;
    $("version").textContent = `Version ${idx + 1}/10`;
    $("palette").textContent = `${pal.game}: ${pal.level}`;
    $("effect").textContent = `${TRANSFORMS[idx].name}: ${fx.improv}, ${fx.env}, ${Math.round(fx.delay * 1000)} ms delay`;
    document.querySelectorAll("#variants li").forEach((li, i) => li.classList.toggle("on", i === idx));
  }
);

function initControls() {
  for (let n = 1; n <= 50; n++) {
    const d = EMBLEMDATA[String(n)];
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = `${String(n).padStart(2, "0")} ${d.roman}: ${d.mottoEn}`;
    $("emblem").appendChild(opt);
  }
  $("emblem").value = state.emblem;
  for (const exp of EXPERIMENTS) {
    const opt = document.createElement("option");
    opt.value = exp.id;
    opt.textContent = exp.name;
    $("experiment").appendChild(opt);
  }
  for (let i = 0; i < 10; i++) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${i + 1}. ${GAME_PALETTES[i].game}</b><br><span>${GAME_PALETTES[i].level} plus ${TRANSFORMS[i].name}</span>`;
    $("variants").appendChild(li);
  }
  $("emblem").onchange = () => setEmblem(Number($("emblem").value));
  $("experiment").onchange = () => setExperiment($("experiment").value);
  $("audio").onclick = toggleAudio;
  $("next").onclick = () => player.next();
  $("mute").onclick = () => {
    player.mute(!player.muted);
    $("mute").textContent = player.muted ? "Unmute" : "Mute";
  };
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouse.x = (e.clientX - r.left) / r.width;
    state.mouse.y = (e.clientY - r.top) / r.height;
  });
  canvas.addEventListener("pointerdown", () => {
    state.mouse.down = true;
    state.heat = Math.max(0, state.heat - 0.18);
    state.orbit = Math.min(1, state.orbit + 0.12);
  });
  addEventListener("pointerup", () => state.mouse.down = false);
}

function setExperiment(id) {
  state.experiment = EXPERIMENTS.find((x) => x.id === id) || EXPERIMENTS[0];
  $("essay-title").textContent = state.experiment.name;
  $("essay").textContent = state.experiment.short;
}

function setEmblem(n) {
  state.emblem = n;
  const d = EMBLEMDATA[String(n)];
  const ex = EXPLAIN[String(n)] || {};
  $("plate").src = imgFor(n);
  $("plate").alt = `Emblem ${d.roman}`;
  plateImg.src = imgFor(n);
  $("kicker").textContent = `Emblem ${d.roman} / ${d.process} / ${d.stage}`;
  $("title").textContent = `Emblem ${d.roman}`;
  $("motto").textContent = d.mottoEn || ex.motto || "";
  if (state.playing) player.play(n);
}

async function toggleAudio() {
  if (!state.loaded) {
    state.loaded = await player.load();
    if (!state.loaded) $("effect").textContent = "Fugue data not found. Start the server from the parent project root.";
  }
  if (!state.playing) {
    player.play(state.emblem);
    state.playing = true;
    $("audio").textContent = "Pause";
  } else {
    player.stop();
    state.playing = false;
    $("audio").textContent = "Play";
  }
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(now) {
  requestAnimationFrame(draw);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const level = player.level();
  state.heat = Math.max(0, state.heat * 0.992 - 0.0008 + level * 0.025);
  state.orbit = (state.orbit + 0.0018 + level * 0.012) % 1;
  state.mercury = Math.max(0, state.mercury * 0.985);
  $("heat").style.width = `${Math.round(state.heat * 100)}%`;
  $("orbit").style.width = `${Math.round(state.orbit * 100)}%`;
  $("mercury").style.width = `${Math.round(state.mercury * 100)}%`;

  const d = EMBLEMDATA[String(state.emblem)] || {};
  const pal = GAME_PALETTES[currentVersion];
  ctx.clearRect(0, 0, w, h);
  drawField(w, h, now, d, pal, level);
  drawExperiment(w, h, now, level, d);
  drawPlate(w, h, now, level);
  drawEvents(w, h, now);
}

function drawField(w, h, now, d, pal, level) {
  const grd = ctx.createLinearGradient(0, 0, w, h);
  const base = d.stage === "ALBEDO" ? "#1d2324" : d.stage === "CITRINITAS" ? "#221d0a" : d.stage === "RUBEDO" ? "#24100d" : "#08080a";
  grd.addColorStop(0, base);
  grd.addColorStop(0.55, "#080806");
  grd.addColorStop(1, currentVersion % 2 ? "#10211e" : "#211510");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  const lines = 18;
  ctx.save();
  ctx.globalAlpha = 0.14 + level * 0.3;
  ctx.strokeStyle = currentVersion % 3 === 0 ? "#77f0ce" : currentVersion % 3 === 1 ? "#edbf56" : "#f3654f";
  for (let i = 0; i < lines; i++) {
    const y = (i / lines) * h + Math.sin(now * 0.0005 + i) * 18;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 24) {
      const yy = y + Math.sin(x * 0.015 + now * 0.0015 + i + state.orbit * 6) * (10 + level * 65);
      x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  void pal;
}

function drawPlate(w, h, now, level) {
  const size = Math.min(w, h) * (0.28 + level * 0.06);
  const x = w * (0.52 + (state.mouse.x - 0.5) * 0.08);
  const y = h * (0.48 - state.heat * 0.18 + Math.sin(now * 0.001) * 0.02);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(now * 0.00035 + currentVersion) * 0.08);
  ctx.shadowColor = currentVersion % 2 ? "#77f0ce" : "#edbf56";
  ctx.shadowBlur = 40 + level * 80;
  ctx.globalAlpha = 0.82;
  if (plateImg.complete && plateImg.naturalWidth) {
    ctx.drawImage(plateImg, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#282016";
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = `rgba(119,240,206,${0.08 + level * 0.2})`;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawExperiment(w, h, now, level, d) {
  const exp = state.experiment.id;
  if (exp === "levitating-athanor") return drawAthanor(w, h, now, level);
  if (exp === "ouroboric-dub") return drawOuroboros(w, h, now, level);
  if (exp === "dewpoint-runner") return drawDew(w, h, now, level);
  if (exp === "sword-egg-breakbeat") return drawSwordEgg(w, h, now, level);
  if (exp === "rose-garden-lockstep") return drawRoseLock(w, h, now, level);
  drawPinball(w, h, now, level, d);
}

function drawAthanor(w, h, now, level) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.56);
  ctx.strokeStyle = "#edbf56";
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 5; i++) {
    const r = 90 + i * 38 + state.heat * 70;
    ctx.beginPath();
    ctx.ellipse(0, -state.heat * 140, r, r * 0.38, Math.sin(now * 0.0006 + i), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOuroboros(w, h, now, level) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#77f0ce";
  ctx.globalAlpha = 0.35 + level;
  const r = Math.min(w, h) * 0.28;
  ctx.beginPath();
  ctx.arc(0, 0, r, now * 0.001, now * 0.001 + Math.PI * 1.82);
  ctx.stroke();
  ctx.fillStyle = "#f3654f";
  ctx.beginPath();
  ctx.arc(Math.cos(now * 0.001 + Math.PI * 1.82) * r, Math.sin(now * 0.001 + Math.PI * 1.82) * r, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDew(w, h, now, level) {
  ctx.save();
  ctx.fillStyle = "rgba(214,220,232,0.58)";
  for (let i = 0; i < 70; i++) {
    const x = (i * 97 + now * 0.035) % w;
    const y = (Math.sin(i * 4.1 + now * 0.001) * 0.35 + 0.5) * h;
    ctx.beginPath();
    ctx.arc(x, y, 2 + ((i + currentVersion) % 6) + level * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSwordEgg(w, h, now, level) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.48);
  ctx.rotate(-0.8 + Math.sin(now * 0.003) * 0.12);
  ctx.fillStyle = "#f3654f";
  ctx.shadowColor = "#f3654f";
  ctx.shadowBlur = 26 + level * 80;
  ctx.fillRect(-8, -h * 0.34, 16, h * 0.68);
  ctx.restore();
}

function drawRoseLock(w, h, now, level) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.strokeStyle = "#edbf56";
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 3; i++) {
    ctx.rotate((now * 0.0002 + level * 0.3) * (i + 1));
    ctx.strokeRect(-110 - i * 42, -110 - i * 42, 220 + i * 84, 220 + i * 84);
  }
  ctx.restore();
}

function drawPinball(w, h, now, level) {
  ctx.save();
  ctx.strokeStyle = "#77f0ce";
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 12; i++) {
    const x = w * (0.18 + (i % 4) * 0.2);
    const y = h * (0.18 + Math.floor(i / 4) * 0.22);
    ctx.beginPath();
    ctx.arc(x + Math.sin(now * 0.002 + i) * 40, y, 26 + level * 24, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEvents(w, h, now) {
  ctx.save();
  for (const e of state.events) {
    const age = now - e.born;
    const p = age / e.life;
    if (p > 1) continue;
    const x = ((e.x / 1000) * w + Math.sin(p * 9 + e.version) * 80) % w;
    const y = h * (0.82 - p * 0.72) + Math.sin(e.midi + p * 12) * 40;
    const r = 3 + (e.midi % 12) * 1.4 + e.energy * 12;
    ctx.globalAlpha = (1 - p) * 0.75;
    ctx.fillStyle = e.version % 3 === 0 ? "#77f0ce" : e.version % 3 === 1 ? "#edbf56" : "#f3654f";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  state.events = state.events.filter((e) => now - e.born < e.life);
  ctx.restore();
}

initControls();
setExperiment(EXPERIMENTS[0].id);
setEmblem(state.emblem);
resize();
addEventListener("resize", resize);
requestAnimationFrame(draw);

window.ANTIGRAV = { player, state, experiments: EXPERIMENTS, transforms: TRANSFORMS };

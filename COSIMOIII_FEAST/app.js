const $ = (id) => document.getElementById(id);

const OPTIONS = {
  course: [
    ["jasmine-chocolate", "Jasmine chocolate service", 32, 12, 36],
    ["capon-citrus", "Capon with bitter orange", 20, 18, 8],
    ["sugar-sculpture", "Sugar architecture", 34, 30, 6],
    ["amber-cordial", "Amber cordial and wafers", 26, 22, 20],
    ["fast-day", "Devout lean-day banquet", 16, 6, 22],
  ],
  perfume: [
    ["mugherino", "Goan jasmine / mugherino", 30, 16, 36],
    ["citron", "Citron and limoncello peel", 20, 10, 14],
    ["cinnamon", "Cinnamon, vanilla, warm spice", 24, 14, 10],
    ["rosewater", "Rosewater and orange blossom", 18, 8, 18],
  ],
  music: [
    ["viols", "Measured viol consort", 18, 8, 8],
    ["intermedio", "Miniature intermedio spectacle", 34, 24, 4],
    ["chamber", "Private chamber serenade", 24, 12, 20],
    ["silence", "Devotional silence", 8, 2, 30],
  ],
  manners: [
    ["forks", "Forks, glass, napkins, choreography", 28, 10, 12],
    ["old-board", "Older trestle-board abundance", 18, 8, 3],
    ["french", "French service rivalry", 26, 18, 6],
    ["monastic", "Austere ceremonial restraint", 12, 3, 28],
  ],
  guest: [
    ["palatine", "Elector Palatine envoy", 30, 16, 18],
    ["french", "French court observer", 24, 14, 6],
    ["spanish", "Spanish chocolate rival", 32, 20, 2],
    ["jesuit", "Jesuit confessor", 10, 4, 34],
    ["merchant", "Leghorn merchant broker", 22, 8, 12],
  ],
};

const DISHES = [
  { name: "cacao", color: "#432016", r: 38 },
  { name: "jasmine", color: "#f6f1da", r: 20 },
  { name: "citrus", color: "#dc9c2d", r: 25 },
  { name: "glass", color: "#a8d8d0", r: 18 },
  { name: "sugar", color: "#fff4db", r: 32 },
  { name: "capon", color: "#b86b3c", r: 34 },
  { name: "spice", color: "#8d3a23", r: 16 },
  { name: "rose", color: "#b94d5e", r: 22 },
  { name: "cordial", color: "#d7af5d", r: 20 },
];

const state = {
  course: "jasmine-chocolate",
  perfume: "mugherino",
  music: "viols",
  manners: "forks",
  guest: "palatine",
  jasmine: 62,
  secret: 76,
  budget: 58,
  served: 0,
  particles: [],
};

const canvas = $("feast");
const ctx = canvas.getContext("2d");

function addOptions() {
  for (const [key, items] of Object.entries(OPTIONS)) {
    const select = $(key);
    for (const item of items) {
      const opt = document.createElement("option");
      opt.value = item[0];
      opt.textContent = item[1];
      select.appendChild(opt);
    }
    select.value = state[key];
    select.addEventListener("change", () => {
      state[key] = select.value;
      burst(18);
      score();
    });
  }
  for (const id of ["jasmine", "secret", "budget"]) {
    $(id).addEventListener("input", () => {
      state[id] = Number($(id).value);
      score();
    });
  }
  $("serve").addEventListener("click", () => {
    state.served += 1;
    burst(70);
    score();
  });
}

function selected(key) {
  return OPTIONS[key].find((x) => x[0] === state[key]);
}

function score() {
  const picks = ["course", "perfume", "music", "manners", "guest"].map(selected);
  const basePrestige = picks.reduce((s, x) => s + x[2], 0);
  const baseDebt = picks.reduce((s, x) => s + x[3], 0);
  const baseSecrecy = picks.reduce((s, x) => s + x[4], 0);
  const jasmineBonus = Math.round(state.jasmine * 0.42);
  const budgetPush = Math.round(state.budget * 0.38);
  const debt = Math.max(0, baseDebt + budgetPush - Math.round(state.secret * 0.08));
  const secrecy = Math.max(0, Math.min(100, Math.round((baseSecrecy + state.secret) / 2)));
  const prestige = Math.max(0, basePrestige + jasmineBonus + Math.round(state.budget * 0.24) - Math.round(debt * 0.28));
  $("prestige").textContent = prestige;
  $("debt").textContent = debt;
  $("secrecy").textContent = secrecy;
  return { prestige, debt, secrecy };
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function burst(count) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (let i = 0; i < count; i++) {
    const dish = DISHES[(i + state.served) % DISHES.length];
    state.particles.push({
      x: w * (0.25 + Math.random() * 0.5),
      y: h * (0.55 + Math.random() * 0.22),
      vx: (Math.random() - 0.5) * 2.2,
      vy: -Math.random() * 2.8 - 0.4,
      life: 120 + Math.random() * 120,
      dish,
    });
  }
}

function draw(now) {
  requestAnimationFrame(draw);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const s = score();
  drawRoom(w, h, now, s);
  drawTable(w, h, now, s);
  drawService(w, h, now, s);
  drawParticles();
}

function drawRoom(w, h, now, s) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#1c0805");
  g.addColorStop(0.48, "#0b0504");
  g.addColorStop(1, s.debt > 70 ? "#2a0808" : "#102018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#e0b45a";
  for (let i = 0; i < 12; i++) {
    const x = (i + 0.5) * w / 12;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x - 40, h * 0.28, x + 60, h * 0.52, x - 20, h);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.16 + s.prestige / 500;
  ctx.fillStyle = "#e0b45a";
  for (let i = 0; i < 34; i++) {
    const x = (i * 113 + now * 0.014) % w;
    const y = h * (0.1 + ((i * 37) % 70) / 100);
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTable(w, h, now, s) {
  const cx = w * 0.5;
  const cy = h * 0.63;
  const tw = Math.min(w * 0.78, 980);
  const th = Math.min(h * 0.33, 270);
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = "#2b140e";
  roundRect(-tw / 2, -th / 2, tw, th, 34);
  ctx.fill();
  ctx.strokeStyle = "rgba(248,239,224,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#fff0d2";
  roundRect(-tw * 0.45, -th * 0.32, tw * 0.9, th * 0.64, 28);
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;

  drawPlaceSettings(tw, th, now, s);
  drawCenterpiece(tw, th, now, s);
  ctx.restore();
}

function drawPlaceSettings(tw, th, now, s) {
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const x = -tw * 0.36 + i * tw * 0.12;
      const y = side * th * 0.28;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.55);
      ctx.fillStyle = "#f8efe0";
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c79d51";
      ctx.stroke();
      ctx.restore();

      if (state.manners === "forks") {
        ctx.strokeStyle = "#a8d8d0";
        ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(x + 38 + k * 4, y - 12);
          ctx.lineTo(x + 38 + k * 4, y + 12);
          ctx.stroke();
        }
      }
    }
  }
  void now; void s;
}

function drawCenterpiece(tw, th, now, s) {
  const course = state.course;
  const perfume = state.perfume;
  const glow = Math.min(1, s.prestige / 160);
  ctx.save();
  ctx.shadowColor = perfume === "mugherino" ? "#fff4db" : "#e0b45a";
  ctx.shadowBlur = 30 + glow * 45;
  ctx.fillStyle = course === "jasmine-chocolate" ? "#432016" : course === "sugar-sculpture" ? "#fff4db" : "#b86b3c";
  ctx.beginPath();
  ctx.ellipse(0, 0, tw * 0.16, th * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e0b45a";
  ctx.lineWidth = 3;
  ctx.stroke();

  const petals = 10 + Math.round(state.jasmine / 8);
  for (let i = 0; i < petals; i++) {
    const a = i / petals * Math.PI * 2 + now * 0.0008;
    const r = 52 + Math.sin(now * 0.002 + i) * 8;
    ctx.fillStyle = i % 2 ? "#f8efe0" : "#d7e8c8";
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r * 0.7, 8, 4, a, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.secret > 65) {
    ctx.strokeStyle = "rgba(157,34,29,0.72)";
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(-tw * 0.23, -th * 0.32, tw * 0.46, th * 0.64);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawService(w, h, now, s) {
  const count = state.music === "intermedio" ? 9 : state.music === "silence" ? 3 : 6;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const p = (i / count + now * 0.00006 * (1 + state.budget / 80)) % 1;
    const x = w * (0.12 + p * 0.76);
    const y = h * (0.2 + Math.sin(p * Math.PI) * 0.18);
    ctx.fillStyle = i % 2 ? "#4b8266" : "#9d221d";
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.arc(x, y, 11 + s.prestige / 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0b45a";
    ctx.fillRect(x - 2, y + 10, 4, 42);
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.025;
    p.life -= 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 90));
    ctx.fillStyle = p.dish.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.dish.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

addOptions();
resize();
score();
burst(36);
addEventListener("resize", resize);
requestAnimationFrame(draw);

window.COSIMO_FEAST = { state, score, burst, options: OPTIONS };

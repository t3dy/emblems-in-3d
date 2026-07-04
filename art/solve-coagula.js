// Solve et Coagula — a contemplative model of the colour sequence of the Work.
// One philosophical egg cooks through nigredo→albedo→citrinitas→rubedo. (Canvas2D)
export function mount(el, opts = {}) {
  const cv = document.createElement("canvas"); cv.style.cssText = "width:100%;height:100%;display:block";
  el.appendChild(cv); const ctx = cv.getContext("2d");
  let W = 0, H = 0;
  function resize() { W = cv.width = el.clientWidth || 820; H = cv.height = el.clientHeight || 460; }
  resize(); addEventListener("resize", resize);

  const STAGES = [
    { name: "Prima materia", gloss: "the sealed matter, opposites unparted", color: [236, 226, 203] },
    { name: "Nigredo", gloss: "the blackening — putrefaction, the death", color: [20, 17, 12] },
    { name: "Albedo", gloss: "the whitening — the washed white swan", color: [238, 240, 234] },
    { name: "Citrinitas", gloss: "the yellowing — the dawning gold", color: [232, 198, 74] },
    { name: "Rubedo", gloss: "the reddening — the red king, the Stone", color: [176, 34, 24] },
  ];
  const S = { i: 0, p: 0, fire: 0.5, t: 0, bubbles: [] };
  const stageDur = () => 3.4 / (0.4 + S.fire * 1.6);
  for (let i = 0; i < 40; i++) S.bubbles.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, v: 0.1 + Math.random() * 0.3 });

  // degree-of-fire via up/down or drag bottom slider
  addEventListener("keydown", (e) => { if (e.code === "ArrowUp") S.fire = Math.min(1, S.fire + 0.1); if (e.code === "ArrowDown") S.fire = Math.max(0, S.fire - 0.1); });
  function px(e) { const b = cv.getBoundingClientRect(); return (e.clientX - b.left) / b.width; }
  cv.addEventListener("pointerdown", (e) => { if (e.clientY) S.fire = Math.max(0, Math.min(1, px(e))); });

  const lerp = (a, b, t) => a + (b - a) * t;
  function curColor() {
    const a = STAGES[S.i].color, b = STAGES[(S.i + 1) % STAGES.length].color, t = S.p;
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }

  function step(dt) {
    S.t += dt;
    S.p += dt / stageDur();
    if (S.p >= 1) { S.p = 0; S.i = (S.i + 1) % STAGES.length; }
    for (const b of S.bubbles) { b.y -= b.v * (0.3 + S.fire) * dt; if (b.y < 0) { b.y = 1; b.x = Math.random(); } }
  }

  function draw() {
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, "#1a160e"); g.addColorStop(1, "#08070500"); ctx.fillStyle = "#0b0905"; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 - 10, R = Math.min(W, H) * 0.26;
    const col = curColor();
    // matter glow
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 60;
    // flask body
    ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 1.18, 0, 0, 7);
    ctx.fillStyle = col; ctx.fill(); ctx.restore();
    // bubbles inside
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, R - 4, R * 1.18 - 4, 0, 0, 7); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (const b of S.bubbles) { ctx.beginPath(); ctx.arc(cx + (b.x - 0.5) * 2 * R, cy + (b.y - 0.5) * 2 * R * 1.18, b.r, 0, 7); ctx.fill(); }
    ctx.restore();
    // glass rim + neck (Seal of Hermes)
    ctx.strokeStyle = "rgba(207,227,218,0.6)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 1.18, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(207,227,218,0.5)"; ctx.fillRect(cx - 10, cy - R * 1.18 - 34, 20, 40);
    // progress ring
    ctx.strokeStyle = "rgba(200,170,110,0.7)"; ctx.lineWidth = 4; ctx.beginPath();
    const frac = (S.i + S.p) / STAGES.length; ctx.arc(cx, cy, R + 26, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    // labels
    ctx.fillStyle = "#f0e7d2"; ctx.textAlign = "center"; ctx.font = "30px Georgia";
    ctx.fillText(STAGES[S.i].name, cx, H - 70);
    ctx.fillStyle = "#b7a877"; ctx.font = "italic 15px Georgia"; ctx.fillText(STAGES[S.i].gloss, cx, H - 44);
    ctx.textAlign = "left";
    // fire slider
    ctx.fillStyle = "#9c8e6e"; ctx.font = "12px Georgia"; ctx.fillText("degree of fire ▸ click / ↑↓", 20, H - 16);
    ctx.fillStyle = "#1a140c"; ctx.fillRect(20, H - 12, 180, 6);
    ctx.fillStyle = "#e8a050"; ctx.fillRect(20, H - 12, 180 * S.fire, 6);
  }

  let raf, last = 0, alive = true;
  function frame(t) { if (!alive) return; raf = requestAnimationFrame(frame); const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t; step(dt); draw(); }
  draw(); raf = requestAnimationFrame(frame);
  return { step, draw, state: () => ({ stage: STAGES[S.i].name, i: S.i, p: +S.p.toFixed(2), fire: S.fire }), destroy() { alive = false; cancelAnimationFrame(raf); } };
}

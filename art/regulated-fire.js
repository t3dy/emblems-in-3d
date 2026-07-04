// The Regulated Fire — Emblem VIII. Raise the heat under the sealed egg and
// strike only when it sits in the hatching band. (Canvas2D)
export function mount(el, opts = {}) {
  const cv = document.createElement("canvas"); cv.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
  el.appendChild(cv); const ctx = cv.getContext("2d");
  let W = 0, H = 0;
  function resize() { W = cv.width = el.clientWidth || 820; H = cv.height = el.clientHeight || 460; }
  resize(); addEventListener("resize", resize);

  const S = { heat: 0, applying: false, phase: "play", result: "", color: "#caa45a",
    band: { lo: 0.58, hi: 0.78 }, score: 0, round: 1, t: 0, fx: 0 };
  function newBand() { const w = Math.max(0.08, 0.2 - S.score * 0.012); const lo = 0.45 + Math.random() * (0.45 - w); S.band = { lo, hi: lo + w }; }
  newBand();

  function strike() {
    if (S.phase !== "play") { reset(); return; }
    const { lo, hi } = S.band;
    if (S.heat < lo) { S.result = "INERT — too little fire; the matter sleeps."; S.color = "#6a7a9a"; }
    else if (S.heat > hi) { S.result = "DESTROYED — the volatile spirit fled the fire."; S.color = "#ff5436"; }
    else { S.result = "HATCHED — the bird rises, conqueror of iron and fire."; S.color = "#ffd86a"; S.score++; }
    S.phase = "result"; S.fx = 1;
  }
  function reset() { S.phase = "play"; S.heat = 0; S.round++; newBand(); S.result = ""; }

  const strikeRect = () => ({ x: W - 150, y: H - 70, w: 130, h: 48 });
  function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function px(e) { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; }
  cv.addEventListener("pointerdown", (e) => { const p = px(e); if (inRect(p.x, p.y, strikeRect())) strike(); else if (S.phase === "play") S.applying = true; else reset(); });
  addEventListener("pointerup", () => (S.applying = false));
  addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); if (S.phase === "play") S.applying = true; } else if (e.code === "Enter") strike(); });
  addEventListener("keyup", (e) => { if (e.code === "Space") S.applying = false; });

  function step(dt) {
    S.t += dt;
    if (S.phase === "play") { S.heat += (S.applying ? 0.45 : -0.28) * dt; S.heat = Math.max(0, Math.min(1, S.heat)); }
    if (S.fx > 0) S.fx = Math.max(0, S.fx - dt * 0.6);
  }

  function draw() {
    ctx.fillStyle = "#0e0b07"; ctx.fillRect(0, 0, W, H);
    // furnace + flames (left), sized by heat
    const fx = 120, fy = H - 60;
    ctx.fillStyle = "#3a2c1a"; ctx.fillRect(fx - 55, fy - 90, 110, 110);
    const fl = 30 + S.heat * 120;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.fillStyle = i % 2 ? "rgba(255,120,30,0.7)" : "rgba(255,210,120,0.7)";
      const w = (24 - i * 2) * (0.7 + Math.sin(S.t * 9 + i) * 0.2);
      ctx.ellipse(fx + (i - 2.5) * 6, fy - 90 - (fl * (0.4 + i * 0.12)) / 2 + 20, w, fl * (0.4 + i * 0.12) / 2, 0, 0, 7); ctx.fill();
    }
    // bench + egg (center)
    const ex = W * 0.5, ey = H - 120;
    ctx.fillStyle = "#6e5436"; ctx.fillRect(ex - 70, ey + 50, 140, 14);
    const glow = S.heat;
    ctx.save(); ctx.translate(ex, ey);
    ctx.shadowColor = `rgba(255,150,60,${glow})`; ctx.shadowBlur = 40 * glow;
    ctx.fillStyle = S.phase === "result" ? S.color : "#ece2cb";
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 46, 0, 0, 7); ctx.fill(); ctx.restore();
    if (S.phase === "result" && S.color === "#ffd86a") { // a rising bird on success
      const by = -60 - S.t * 0 - (1 - S.fx) * 120;
      ctx.fillStyle = "#23190f"; ctx.beginPath(); ctx.moveTo(ex - 16, ey + by); ctx.quadraticCurveTo(ex, ey + by - 14, ex + 16, ey + by); ctx.lineWidth = 3; ctx.strokeStyle = "#23190f"; ctx.stroke();
    }
    // heat meter (right)
    const mx = W - 70, mtop = 60, mh = H - 200;
    ctx.fillStyle = "#1a140c"; ctx.fillRect(mx, mtop, 28, mh);
    ctx.fillStyle = "rgba(120,220,120,0.35)"; ctx.fillRect(mx, mtop + mh * (1 - S.band.hi), 28, mh * (S.band.hi - S.band.lo));
    ctx.fillStyle = `rgb(${120 + S.heat * 135},${180 - S.heat * 120},${60})`; ctx.fillRect(mx, mtop + mh * (1 - S.heat), 28, 4);
    ctx.fillStyle = "#9c8e6e"; ctx.font = "11px Georgia"; ctx.fillText("HEAT", mx - 2, mtop - 8); ctx.fillText("hatch", mx - 36, mtop + mh * (1 - S.band.hi) + 12);
    // strike button
    const r = strikeRect(); ctx.fillStyle = "rgba(120,40,20,0.85)"; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#e8a060"; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#f0e4c2"; ctx.font = "16px Georgia"; ctx.fillText("⚔ STRIKE", r.x + 22, r.y + 30);
    // HUD
    ctx.fillStyle = "#e8ddc4"; ctx.font = "14px Georgia";
    ctx.fillText(`Hold SPACE / press the furnace to heat · ENTER / ⚔ to strike`, 20, 26);
    ctx.fillText(`Hatched: ${S.score}`, 20, 48);
    if (S.phase === "result") { ctx.fillStyle = S.color; ctx.font = "20px Georgia"; ctx.fillText(S.result, ex - ctx.measureText(S.result).width / 2, ey - 90); ctx.fillStyle = "#9c8e6e"; ctx.font = "13px Georgia"; ctx.fillText("click / any key to continue", ex - 70, ey - 64); }
  }

  let raf, last = 0, alive = true;
  function frame(t) { if (!alive) return; raf = requestAnimationFrame(frame); const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t; step(dt); draw(); }
  draw(); raf = requestAnimationFrame(frame);
  return { step, draw, state: () => ({ ...S }), strike, setApply: (v) => (S.applying = v), destroy() { alive = false; cancelAnimationFrame(raf); } };
}

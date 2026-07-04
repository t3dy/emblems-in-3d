// The Dragon That Devours Its Tail — Emblem XIV. A wrapping snake: feed on
// quicksilver to grow, then bite your own tail to "close the circle" and
// advance a colour-stage. No walls — circulation is unbounded. (Canvas2D)
export function mount(el, opts = {}) {
  const cv = document.createElement("canvas"); cv.style.cssText = "width:100%;height:100%;display:block";
  el.appendChild(cv); const ctx = cv.getContext("2d");
  const COLS = 24, ROWS = 16;
  let W = 0, H = 0, cell = 24;
  function resize() { W = cv.width = el.clientWidth || 820; H = cv.height = el.clientHeight || 460; cell = Math.floor(Math.min(W / COLS, (H - 40) / ROWS)); }
  resize(); addEventListener("resize", resize);

  const STAGES = ["nigredo", "albedo", "citrinitas", "rubedo"];
  const STAGE_COL = ["#6878a0", "#d6dce8", "#ffd86a", "#ff6a44"];
  const S = { snake: [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }], dir: { x: 1, y: 0 }, nd: { x: 1, y: 0 },
    food: { x: 14, y: 8 }, acc: 0, interval: 0.16, stage: 0, circulations: 0, score: 0, flash: 0, t: 0 };

  function placeFood() { S.food = { x: 1 + Math.floor(Math.random() * (COLS - 2)), y: 1 + Math.floor(Math.random() * (ROWS - 2)) }; }
  addEventListener("keydown", (e) => {
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code];
    if (!m) return; e.preventDefault();
    if (m[0] !== -S.dir.x || m[1] !== -S.dir.y) S.nd = { x: m[0], y: m[1] }; // no instant reverse
  });

  function move() {
    S.dir = S.nd;
    const head = { x: (S.snake[0].x + S.dir.x + COLS) % COLS, y: (S.snake[0].y + S.dir.y + ROWS) % ROWS }; // wrap
    // self-collision = "close the circle"
    const hit = S.snake.findIndex((s) => s.x === head.x && s.y === head.y);
    if (hit >= 0) {
      if (S.snake.length >= 6) { S.circulations++; S.score += S.snake.length * 10; S.stage = Math.min(STAGES.length - 1, S.stage + 1); S.flash = 1; S.snake = S.snake.slice(0, 3); return; }
      // too short to count — just nudge, no growth
    }
    S.snake.unshift(head);
    if (head.x === S.food.x && head.y === S.food.y) { S.score += 5; placeFood(); }
    else S.snake.pop();
  }

  function step(dt) {
    S.t += dt; if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 1.5);
    S.acc += dt; const iv = Math.max(0.08, S.interval - S.circulations * 0.005);
    while (S.acc >= iv) { S.acc -= iv; move(); }
  }

  function draw() {
    const ox = (W - COLS * cell) / 2, oy = 36;
    ctx.fillStyle = "#0c0a07"; ctx.fillRect(0, 0, W, H);
    // field
    ctx.strokeStyle = "rgba(200,170,110,0.08)";
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(ox + x * cell, oy); ctx.lineTo(ox + x * cell, oy + ROWS * cell); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * cell); ctx.lineTo(ox + COLS * cell, oy + y * cell); ctx.stroke(); }
    // quicksilver
    ctx.fillStyle = "#cfe3ea"; ctx.shadowColor = "#cfe3ea"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(ox + S.food.x * cell + cell / 2, oy + S.food.y * cell + cell / 2, cell * 0.32, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    // dragon
    const col = STAGE_COL[S.stage];
    S.snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#f0e7d2" : col;
      ctx.globalAlpha = i === 0 ? 1 : 0.55 + 0.45 * (1 - i / S.snake.length);
      const r = cell * (i === 0 ? 0.46 : 0.4);
      ctx.beginPath(); ctx.arc(ox + s.x * cell + cell / 2, oy + s.y * cell + cell / 2, r, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,220,120,${S.flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
    // HUD
    ctx.fillStyle = "#e8ddc4"; ctx.font = "14px Georgia";
    ctx.fillText(`Circulations: ${S.circulations}   Score: ${S.score}   Stage: ${STAGES[S.stage]}`, ox, 24);
    ctx.fillStyle = "#9c8e6e"; ctx.font = "12px Georgia";
    ctx.fillText("arrows / WASD · eat quicksilver to grow · bite your own tail (len ≥ 6) to close the circle", ox, oy + ROWS * cell + 22);
  }

  let raf, last = 0, alive = true;
  function frame(t) { if (!alive) return; raf = requestAnimationFrame(frame); const dt = Math.min((t - last) / 1000 || 0, 0.05); last = t; step(dt); draw(); }
  draw(); raf = requestAnimationFrame(frame);
  return { step, draw, setDir: (x, y) => (S.nd = { x, y }), state: () => ({ len: S.snake.length, circulations: S.circulations, score: S.score, stage: STAGES[S.stage] }), destroy() { alive = false; cancelAnimationFrame(raf); } };
}

// ===========================================================================
// cutscene.js — the intro cut-scene sequence and the "Read the Emblem" mode.
// Pure DOM. main.js wires callbacks (enter the scene / focus a 3D object).
// ===========================================================================

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// ---------------------------------------------------------------------------
// Intro cut-scene: a sequence of plates ending with "enter the courtyard".
// ---------------------------------------------------------------------------
export function runIntro(emblem, onEnter) {
  const host = el("div", "cs-host");
  document.body.appendChild(host);

  // Build slides
  const slides = [];

  // 1 — title plate
  slides.push(el("div", "cs-slide cs-title", `
    <p class="cs-series">ATALANTA FUGIENS · 1617</p>
    <p class="cs-num">EMBLEMA ${emblem.number}</p>
    <h1>${emblem.mottoEnglish}</h1>
    <p class="cs-latin">${emblem.mottoLatin}</p>
  `));

  // 2 — the engraving itself (the 2D emblem image)
  slides.push(el("div", "cs-slide", `
    <figure class="cs-figure">
      <img src="assets/emblem-08.jpg" alt="Emblem VIII engraving" />
      <figcaption>Michael Maier, <i>Atalanta Fugiens</i>, Emblem VIII — Matthäus Merian's engraving.</figcaption>
    </figure>
  `));

  // 3 — the epigram (verse)
  slides.push(el("div", "cs-slide", `
    <p class="cs-num">EPIGRAM ${emblem.number}</p>
    <blockquote class="cs-verse">${emblem.epigram.map(l => l + "<br/>").join("")}</blockquote>
  `));

  // 4 — Diogenes / the egg as the parts of philosophy
  const dio = emblem.diogenes;
  const dioSlide = el("div", "cs-slide cs-dio", `
    <div class="cs-dio-img" id="cs-dio-img">
      <img src="${dio.imageSlot}" alt="Diogenes Laertius, 1688 engraving" />
      <div class="cs-dio-placeholder">[ 1688 engraving of Diogenes — drop <code>${dio.imageSlot}</code> ]</div>
    </div>
    <div class="cs-dio-text">
      <blockquote>${dio.text}</blockquote>
      <p class="cs-cite">${dio.cite}</p>
      ${dio.imageCredit ? `<p class="cs-cite cs-imgcredit">${dio.imageCredit}</p>` : ""}
    </div>
  `);
  slides.push(dioSlide);

  // 5 — call to action / enter
  slides.push(el("div", "cs-slide cs-enter", `
    <h2 class="cs-cta">${emblem.callToAction}</h2>
    <p class="cs-hint">First the courtyard, then the laboratory.</p>
    <button class="cs-btn cs-enter-btn">Enter the courtyard ▸</button>
    <p class="cs-controls">WASD walk · mouse look · <b>E</b> strike · <b>R</b> read the emblem · ESC release</p>
  `));

  slides.forEach(s => host.appendChild(s));

  // graceful image fallback for the Diogenes plate (file may not exist yet)
  const dioImg = dioSlide.querySelector("img");
  dioImg.addEventListener("error", () => dioSlide.querySelector(".cs-dio-img").classList.add("missing"));

  // nav
  const nav = el("div", "cs-nav");
  const back = el("button", "cs-btn cs-ghost", "◂ Back");
  const next = el("button", "cs-btn", "Next ▸");
  const dots = el("div", "cs-dots");
  slides.forEach(() => dots.appendChild(el("span", "cs-dot")));
  nav.append(back, dots, next);
  host.appendChild(nav);

  let i = 0;
  function show(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => s.classList.toggle("active", k === i));
    [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i));
    back.style.visibility = i === 0 ? "hidden" : "visible";
    next.style.visibility = i === slides.length - 1 ? "hidden" : "visible";
  }
  back.onclick = () => show(i - 1);
  next.onclick = () => show(i + 1);

  function key(e) {
    if (e.key === "ArrowRight") show(i + 1);
    else if (e.key === "ArrowLeft") show(i - 1);
    else if (e.key === "Enter" && i === slides.length - 1) enter();
  }
  addEventListener("keydown", key);

  function enter() {
    removeEventListener("keydown", key);
    host.classList.add("closing");
    setTimeout(() => host.remove(), 700);
    onEnter && onEnter();
  }
  host.querySelector(".cs-enter-btn").onclick = enter;

  show(0);
  requestAnimationFrame(() => host.classList.add("ready"));
  return { close: enter };
}

// ---------------------------------------------------------------------------
// "Read the Emblem" mode: a guided tour panel over the live 3D scene.
// onFocus(focusKey) lets main.js move the camera to the relevant object.
// ---------------------------------------------------------------------------
export function makeReadMode(emblem, { onFocus, onOpen, onClose }) {
  const panel = el("div", "rm-panel");
  panel.innerHTML = `
    <div class="rm-head">
      <span class="rm-title">Read the Emblem · ${emblem.number}</span>
      <button class="rm-close" title="Close (R / Esc)">✕</button>
    </div>
    <div class="rm-tabs">
      <button class="rm-tab on" data-tab="tour">Guided tour</button>
      <button class="rm-tab" data-tab="discourse">Discourse</button>
    </div>
    <div class="rm-body"></div>
    <div class="rm-foot">
      <button class="rm-btn rm-prev">◂ Prev</button>
      <span class="rm-step"></span>
      <button class="rm-btn rm-next">Next ▸</button>
    </div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector(".rm-body");
  const stepLbl = panel.querySelector(".rm-step");
  let tab = "tour", step = 0, open = false;

  function renderTour() {
    const t = emblem.tour[step];
    body.innerHTML = `
      <div class="rm-card">
        <p class="rm-symbol">${t.symbol}</p>
        <h3>${t.title}</h3>
        <p class="rm-section-label">In the discourse</p>
        <p class="rm-discourse">${t.discourse}</p>
        <p class="rm-section-label">In the laboratory</p>
        <p class="rm-lab">${t.lab}</p>
        <p class="rm-cite">${t.cite}</p>
      </div>`;
    stepLbl.textContent = `${step + 1} / ${emblem.tour.length}`;
    onFocus && onFocus(t.focus);
  }
  function renderDiscourse() {
    body.innerHTML =
      `<div class="rm-card rm-prose">` +
      `<p class="rm-symbol">Summary of the Discourse · after H.M.E. de Jong (1969)</p>` +
      emblem.discourse.map(p => `<p>${p}</p>`).join("") +
      `</div>`;
    stepLbl.textContent = "";
  }
  function render() {
    panel.querySelectorAll(".rm-tab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    panel.querySelector(".rm-foot").style.visibility = tab === "tour" ? "visible" : "hidden";
    if (tab === "tour") renderTour(); else renderDiscourse();
  }

  panel.querySelectorAll(".rm-tab").forEach(b =>
    b.onclick = () => { tab = b.dataset.tab; render(); });
  panel.querySelector(".rm-prev").onclick = () => { step = (step - 1 + emblem.tour.length) % emblem.tour.length; render(); };
  panel.querySelector(".rm-next").onclick = () => { step = (step + 1) % emblem.tour.length; render(); };
  panel.querySelector(".rm-close").onclick = () => api.close();

  const api = {
    get isOpen() { return open; },
    open() {
      if (open) return; open = true;
      panel.classList.add("show"); render(); onOpen && onOpen();
    },
    close() {
      if (!open) return; open = false;
      panel.classList.remove("show"); onClose && onClose();
    },
    toggle() { open ? api.close() : api.open(); },
  };
  return api;
}

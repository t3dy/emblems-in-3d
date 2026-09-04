// ===========================================================================
// narration.js — what the world says, in layers, and where every layer came
// from.
//
// The tour does not hand you one blob of prose. It hands you the commentary in
// LEVELS, each colour-coded by archetype, so a reader can see at a glance which
// register they are in:
//
//   motto       Maier's own motto, Latin and English
//   epigram     Maier's own verse
//   image       what Merian actually engraved
//   discourse   Maier's prose discourse
//   dejong      H.M.E. de Jong's reading, with her page where the record has one
//   historical  the other scholars — Craven, Tilton, Forshaw, Szulakowska…
//   alchemical  the alchemical or hermetic text the discourse is citing
//   myth        the classical or biblical story being alluded to
//   register    one figure unpacked in four registers at once — in the
//               laboratory, in the body, in the soul, in the heavens
//
// Nothing here is written by the renderer. tools/build_world.py assembles the
// boxes out of the Claudiens database; this module only lays them out. Where a
// row is machine-assembled rather than read by a person it says so, because
// that is the state of the record and not something to hide behind good
// typography.
// ===========================================================================

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const lines = (s) => esc(s).replace(/\n/g, "<br>");

export const ARCHETYPE_LABEL = {
  // Poliphilo
  title: "The cut",
  narrative: "In the dream",
  scholarship: "Scholarship",
  influence: "Afterlife",
  elements: "Depicted",
  term: "Dictionary",
  marginalia: "A reader's hand",
  // Atalanta
  motto: "Motto",
  epigram: "Epigram",
  image: "The engraving",
  discourse: "Maier's discourse",
  dejong: "De Jong",
  historical: "Historical",
  alchemical: "Alchemical source",
  myth: "Myth unpacked",
  register: "Four registers",
  solve: "The geometry",
};

export const ARCHETYPE_ORDER = [
  "motto", "epigram", "title", "image", "narrative", "discourse", "dejong",
  "historical", "scholarship", "alchemical", "myth", "term", "elements",
  "influence", "marginalia", "register",
];

/** One commentary box. The archetype drives its colour, and the colour is the
 *  whole point: you should not have to read a paragraph to find out whether it
 *  is Maier speaking or a modern scholar reading him. */
function boxHTML(b, i) {
  const a = esc(b.archetype);
  const parts = [];
  parts.push(`<article class="w-box w-a-${a}" data-i="${i}" data-arch="${a}">`);
  parts.push(`<header class="w-box-h">
    <span class="w-box-tag">${esc(ARCHETYPE_LABEL[b.archetype] || b.archetype)}</span>
    <span class="w-box-ttl">${esc(b.title)}</span>
    ${b.note ? `<span class="w-box-note">${esc(b.note)}</span>` : ""}
  </header>`);

  if (b.latin) parts.push(`<p class="w-latin">${lines(b.latin)}</p>`);
  if (b.body) parts.push(`<p class="${b.verse ? "w-verse" : ""}">${lines(b.body)}</p>`);

  if (b.registers?.length) {
    parts.push(`<dl class="w-regs">` + b.registers.map((r) =>
      `<dt>${esc(r.label)}</dt><dd>${lines(r.text)}</dd>`).join("") + `</dl>`);
  }

  if (b.cite) parts.push(`<p class="w-cite">${esc(b.cite)}</p>`);
  parts.push(`</article>`);
  return parts.join("");
}

export function stationHTML(st, { only = null } = {}) {
  const tier = st.geometry.tier;
  const p = st.plate;
  const out = [];

  out.push(`<div class="w-head">
    <span class="w-num">${esc(st.roman ? "Emblema " + st.roman
      : (st.title || (st.section_label ? st.section_label : "Title page")))}</span>
    <span class="w-stage w-${esc((st.stage || "").toLowerCase())}">${esc(st.section_label || st.stage || "")}</span>
    ${st.signature ? `<span class="w-sig">sig. ${esc(st.signature)} · p. ${esc(st.page)}</span>` : ""}
    <span class="w-setting">${esc(st.setting)}</span>
    ${st.process ? `<span class="w-proc">${esc(st.process)}</span>` : ""}
    <span class="w-tier w-tier-${tier}">${
      tier === "measured" ? "solved"
      : tier === "leaf" ? "whole leaf"
      : "no horizon recoverable"}</span>
  </div>`);

  const boxes = (st.commentary || []).filter((b) => !only || only.has(b.archetype));
  out.push(`<div class="w-boxes">` + boxes.map(boxHTML).join("") + `</div>`);

  // --- the geometry, stated -------------------------------------------------
  const solve = [];
  if (tier === "leaf") {
    solve.push(`<li>The <b>whole 1499 leaf</b> stands here, uncropped. There are no
      perspective solves for this corpus and none is pretended.</li>`);
    solve.push(st.geometry.cards.length
      ? `<li>The woodcut was <b>located on the page</b> and pops forward off it in
         <b>parallel projection</b> — apparent size never changes, so no depth is
         claimed. ${lines(p.detector_note || "")}</li>`
      : `<li>The detector did <b>not</b> find the woodcut confidently on this leaf, so
         nothing pops and the page stands flat. ${lines(p.detector_note || "")}</li>`);
  } else if (tier === "measured") {
    solve.push(`<li><b>horizon</b> row ${p.horizon_y} of ${p.h} px</li>`);
    solve.push(`<li><b>focal length</b> ${Math.round(p.focal_px)} px</li>`);
    solve.push(`<li><b>eye height</b> ${p.eye_height_m} m</li>`);
    solve.push(`<li><b>depths from</b> <code>Z = f·E/(y − horizon)</code>, at each element's ground contact</li>`);
    solve.push(p.solve_reviewed
      ? `<li>This solve was <b>measured by hand and reviewed</b>.</li>`
      : `<li>This solve came out of the <b>automatic pass and has not been checked by a person</b>; the review app is where that happens.</li>`);
    if (p.focal_basis) solve.push(`<li class="w-basis">${lines(p.focal_basis)}</li>`);
  } else {
    solve.push(p.rejected
      ? `<li>This plate has <b>no admissible horizon</b>${st.armature_class ? ` (class: <b>${esc(st.armature_class)}</b>)` : ""}, so it is not given one.</li>`
      : `<li>The armature router found <b>no recoverable horizon</b> on this plate${st.armature_class ? ` (class: <b>${esc(st.armature_class)}</b>)` : ""}, so it is not given one.</li>`);
    solve.push(`<li>The sheet and its ${st.geometry.cards.length} cutout${st.geometry.cards.length === 1 ? "" : "s"} pop in <b>parallel projection</b>: apparent size never changes, so no depth is claimed.</li>`);
    if (p.rejected) solve.push(`<li class="w-basis"><b>A solve was found and rejected.</b> ${lines(p.rejected)}</li>`);
    if (st.armature_basis) solve.push(`<li class="w-basis">${lines(st.armature_basis)}</li>`);
  }
  out.push(`<article class="w-box w-a-solve"><header class="w-box-h">
      <span class="w-box-tag">The geometry</span>
      <span class="w-box-ttl">What the plate gave us</span>
    </header><ul class="w-solve">${solve.join("")}</ul></article>`);

  const pr = st.provenance || {};
  out.push(`<p class="w-prov">Text assembled by corpus extraction from the project's
    scholarly database (${esc(pr.source_method || "unknown method")},
    ${esc(pr.review_status || "status unrecorded")},
    confidence ${esc(pr.confidence || "unrecorded")}).
    ${(pr.review_status || "").toUpperCase() === "REVIEWED"
      ? "Marked reviewed in the database."
      : "Not reviewed by a human scholar."}</p>`);

  return out.join("\n");
}

/** The one-line thing the HUD shows as you walk past. */
export function stationLabel(st) {
  if (st.motto?.en || st.motto?.la) {
    return `${st.roman || "Title"} · ${st.motto.en || st.motto.la}`;
  }
  // Poliphilo: the leaf's own title, and where in the dream it stands
  return `${st.title || st.slug || st.key}${st.section_label ? " · " + st.section_label : ""}`;
}

// ===========================================================================
// experiments.js — the catalogue of "alchemical experiments": small games,
// animations and models built from the call-to-action of an emblem's epigram
// and Maier's discourse. Each entry carries a card preview + a full essay.
// The artifact for <id> lives in art/<id>.js and exports mount(el, {chip}).
// ===========================================================================

const AF_IMG = (n) => `/EmblemPrintShop/sources/claudiens/site/images/emblems/emblem-${String(n).padStart(2,"0")}.jpg`;

export const EXPERIMENTS = [
  {
    id: "regulated-fire",
    title: "The Regulated Fire",
    kind: "Game",
    emblem: "VIII",
    emblemN: 8,
    thumb: AF_IMG(8),
    tags: ["calcination / digestion", "nigredo", "skill / timing"],
    preview:
      "Emblem VIII commands: “Take the egg and smite it with a fiery sword.” But Maier's discourse insists the blow is really heat, and that everything hinges on degree — “attack it cautiously,” with the gentle warmth that hatches an egg. This is a timing game about that single lesson: raise the fire under the sealed egg and strike only when the heat sits in the narrow hatching band. Too little and the matter sleeps; too much and the volatile spirit flees the glass.",
    essay: `
      <p><b>The call to action.</b> Emblem VIII's motto — <i>Accipe ovum &amp; igneo percute gladio</i>, “Take the egg and smite it with a fiery sword” — reads like an act of violence. Maier's discourse quietly corrects that reading. The “egg” is glossed in his own source as <i>the vessel</i> (<i>ovum, id est, vas</i>); the “sword” is fire; and the philosophers, he says, “prefer a moderate warmth — the warmth by which an egg is hatched.” The whole emblem is a warning about <i>degree of fire</i>.</p>
      <p><b>The chemistry.</b> In a sealed glass the matter must be opened, not incinerated. The Turba (quoted by Maier) is explicit and procedural: expel the first moisture with a gentle fire, then close the vessel when the fire is intensified, “lest the body of the ore and its volatile spirit should escape.” Too little heat leaves the matter inert; too much drives off the mercury you were trying to fix. The operation lives or dies on a narrow window.</p>
      <p><b>The design.</b> So the game is a single dial: a heat meter you raise by holding the fire and that decays when you let go, and a shifting “hatching band” you must land in at the moment you strike. Land low → <i>inert</i>. Land high → <i>destroyed</i>. Land in the band → the egg opens and the bird rises, “a conqueror of iron and fire.” The band narrows as you succeed, dramatising how the adept's control must grow finer as the Work proceeds. There is no enemy here but your own impatience — which is exactly Maier's point.</p>`,
  },
  {
    id: "solve-coagula",
    title: "Solve et Coagula — the Colours of the Work",
    kind: "Animation",
    emblem: "the Opus",
    emblemN: 21,
    thumb: AF_IMG(21),
    tags: ["digestion / circulation", "nigredo→rubedo", "contemplative model"],
    preview:
      "The progress of the Great Work was read in colour: the sealed matter blackens, whitens, yellows, then reddens into the Stone. This is a contemplative model of that sequence — a single philosophical egg cooking through nigredo, albedo, citrinitas and rubedo on a loop. A degree-of-fire control speeds or slows the concoction, and the bubbling within tracks the heat. It is less a game than an instrument for watching the canonical colour-clock of alchemy turn.",
    essay: `
      <p><b>The idea.</b> Long before instruments, the alchemist's progress bar was <i>colour</i>. The matter sealed in the philosophical egg was said to pass through a fixed sequence — black (<i>nigredo</i>, the death/putrefaction), white (<i>albedo</i>, the washing), yellow (<i>citrinitas</i>), and finally red (<i>rubedo</i>, the Stone). Historians of chymistry (Principe, Newman) treat these as genuinely <i>observed</i> colour changes in real reactions, not only as symbols.</p>
      <p><b>The model.</b> This experiment renders that clock literally: one vessel, gently heated, its contents morphing smoothly through the four stages and back, with rising bubbles whose vigour tracks the “degree of fire.” The stage names and a one-line gloss fade in as each colour arrives. Slow the fire and the concoction lingers in each phase; raise it and the cycle quickens — but the sequence never skips, because the Work cannot.</p>
      <p><b>Why an animation and not a game.</b> Some emblems resolve into a challenge; this one resolves into <i>patience</i>. The design deliberately removes the player's agency down to a single dial, so that the only thing to “do” is watch and regulate — the contemplative discipline the texts demand of the operator at the furnace.</p>`,
  },
  {
    id: "ouroboros",
    title: "The Dragon That Devours Its Tail",
    kind: "Game",
    emblem: "XIV",
    emblemN: 14,
    thumb: AF_IMG(14),
    tags: ["circulation", "ouroboros", "arcade"],
    preview:
      "Emblem XIV gives the oldest sign in alchemy: the dragon biting its own tail — the ouroboros, “one is all.” It figures circulation: the endless turning of the matter back upon itself until it is purified. Here it becomes an arcade game where you steer the dragon through a wrapping field, feeding on quicksilver to grow, then close the circle by catching your own tail to complete a circulation and advance a colour-stage. The board has no walls because the Work has no edges — only the turning.",
    essay: `
      <p><b>The call to action.</b> The ouroboros — <i>ἓν τὸ πᾶν</i>, “one is all” — is alchemy's most ancient emblem, and Maier's Emblem XIV sets the dragon devouring its own tail. It is the picture of <i>circulation</i>: vapour rising, condensing, and returning to the body again and again, each pass refining the matter. The dragon eats itself and is not diminished; it is concentrated.</p>
      <p><b>The design.</b> A snake game is almost embarrassingly the right form. You guide the dragon across a field that <i>wraps</i> at every edge — there are no walls, because circulation is unbounded; leaving one side is simply re-entering at the other. Quicksilver orbs lengthen the dragon (the matter accreting). When the dragon has grown enough and you steer its head into its own body, it does not die: it “closes the circle,” completing a circulation, advancing the colour-stage (nigredo → albedo → citrinitas → rubedo) and resetting to a tighter coil to begin again.</p>
      <p><b>The inversion.</b> Classic snake punishes self-collision with death; this one <i>rewards</i> it, because in the ouroboros self-consumption is the entire point. The mechanical inversion is the argument: what looks like self-destruction is, in the Work, self-perfection.</p>`,
  },
];

export const EXP_BY_ID = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]));

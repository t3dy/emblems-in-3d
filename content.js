// ===========================================================================
// content.js — the scholarly text for Emblem VIII of Atalanta Fugiens (1617)
// and the alchemical "read the emblem" tour + lab operations.
//
// Sources (researched from C:\Dev\Claudiens and C:\Dev\ALCHEMYTIMELINEMAP):
//  - H.M.E. de Jong, *Michael Maier's Atalanta Fugiens: Sources of an
//    Alchemical Book of Emblems* (Nicolas Hays, 1969) — discourse summary,
//    motto source (Opus Mulierum, in Artis Auriferae II, 192).
//  - H.J. Sheppard, "Egg Symbolism in Alchemy," *Ambix* 6.3 (1958).
//  - W.R. Newman, *Gehennical Fire*; L.M. Principe, *The Secrets of Alchemy*
//    (Univ. of Chicago, 2013) — antimony regulus (Mars + Vulcan).
//  - B.T. Moran, *Distilling Knowledge*; D. Bilak, "Laboratories and
//    Technology," in Moran (ed.), *A Cultural History of Chemistry, Early
//    Modern Age*.
// ===========================================================================

export const EMBLEM8 = {
  number: "VIII",
  mottoLatin: "Accipe ovum & igneo percute gladio.",
  mottoEnglish: "Take the egg and smite it with a fiery sword.",
  callToAction: "Take the egg and smite it with a fiery sword.",

  // The epigram (De Jong's English; matches the text the player provided)
  epigram: [
    "There is a bird in the world, more sublime than all,",
    "Let it be your only care to find its egg.",
    "The albumen softly surrounds the golden yolk,",
    "Attack it cautiously with a fiery sword (as is the custom);",
    "Let Mars assist Vulcan; the bird arising from it",
    "Will be a conqueror of iron and fire.",
  ],

  // Diogenes Laertius / Stoicorum Veterum Fragmenta SVF II.38b — the egg as a
  // figure for the parts of philosophy (logic = shell, ethics = white,
  // physics = yolk). Used in the intro cut-scene.
  diogenes: {
    cite: "Diogenes Laertius · Stoicorum Veterum Fragmenta, SVF II.38b",
    imageSlot: "assets/diogenes-1688.jpg", // 1688 engraving
    imageCredit: "Engraved frontispiece, Diogenes Laertius, <i>The Lives, Opinions, and Remarkable Sayings of the Most Famous Ancient Philosophers</i> (London: Edward Brewster, 1688). Public domain, via Wikimedia Commons.",
    text:
      "Philosophy, they say, is like an animal: logic corresponding to the " +
      "bones and sinews, ethics to the fleshy parts, physics to the soul. " +
      "Another simile they use is that of an egg: the shell is logic, next " +
      "comes the white, and the yolk in the center is physics. Or again, they " +
      "liken philosophy to a fertile field: logic being the enclosing fence, " +
      "ethics the crop, physics the soil or the trees…",
  },

  // De Jong's "Summary of the Discourse" (verbatim, OCR spacing repaired) —
  // the long prose argument, shown in "Read the Emblem" mode.
  discourse: [
    "Among the countless species of birds there seems to be a species, on an island of the Ocean, which can take an elephant up into the air. The Egyptians destroy crocodiles' eggs each year with a sword.",
    "The philosophers pierce their egg with fire in order to bring it to life and to let it grow — not to destroy it; no more than the coming to life of a human being out of an egg is a process of destruction, although by this the egg-shape is destroyed. It is replaced by a nobler form, a two-footed winged animal.",
    "In the egg the body grows out of the yolk, the albumen provides food, and the warmth from outside is the prime mover, which — with the circulation of the elements and the transmutation of one element into another — creates a new form under the guidance of Nature. For water passes into air, air into fire, fire into earth; and when they are all united they discard their specific form and become one individual of the bird species from which the egg comes.",
    "The egg should be smashed by a fiery sword, which Vulcan uses in his function of a midwife, assisting the young one to be born. This is what Basil Valentine declares, when he says that Mercury is locked up in gaol by Vulcan at the order of Mars, and is only allowed to leave when he is quite crushed and dead — a personification of the putrefactio.",
    "In reality this death is the gate to a new life, just as the destruction of the egg gives life to a new bird. Therefore Lullius also calls the fiery sword 'the sharp lance.' For the fire pierces the bodies as a sharp sword and makes them porous, so that the water may penetrate and dissolve them, turning hardness into softness, to make them malleable.",
    "Nevertheless the philosophers prefer a moderate warmth — the warmth by which an egg is hatched. As the Turba states: 'The first moisture should first be expelled, o wise men, by burning it in a gentle fire, as we see in the hatching of a young bird. When the fire is intensified, let the retort be well closed, lest the body of the ore and its volatile spirit should escape.'",
  ],

  // The guided tour: each step links a SYMBOL in the emblem to its physical /
  // chemical meaning and to a concrete laboratory operation the player can run
  // in the adjacent lab. `focus` names a 3D object to look at (set in main.js).
  tour: [
    {
      title: "The Egg — the sealed vessel",
      symbol: "ovum / vas",
      focus: "egg",
      discourse:
        "“Accipe ovum, id est, vas” — “Take the egg, that is, the vessel.” " +
        "Maier's own source glosses the egg as the retort itself.",
      lab:
        "Physically the philosophical egg is a thick ovoid glass flask whose " +
        "neck is fused shut — the 'Seal of Hermes,' origin of 'hermetically " +
        "sealed.' The whole Work happens inside this one closed vessel.",
      cite: "De Jong 1969 (Opus Mulierum, Art. Aurif. II.192); Sheppard, Ambix 1958",
    },
    {
      title: "White & Yolk — Mercury and Sulphur",
      symbol: "albumen / vitellus",
      focus: "egg",
      discourse:
        "“The albumen softly surrounds the golden yolk.” The white nourishes; " +
        "the yolk is the seed from which the body grows.",
      lab:
        "In the chymical reading the white is the Mercury (the volatile, " +
        "dissolving water) and the yolk is the Sulphur (the fixed body / seed). " +
        "Sealed together they are the prima materia, the opposites not yet parted.",
      cite: "Sheppard, Ambix 1958; Claudiens dictionary: philosophical-egg, vas-hermeticum",
    },
    {
      title: "The Fiery Sword — controlled fire",
      symbol: "igneus gladius",
      focus: "furnace",
      discourse:
        "“The fire pierces the bodies as a sharp sword and makes them porous, " +
        "so that the water may penetrate and dissolve them, turning hardness " +
        "into softness.” Lullius calls it 'the sharp lance.'",
      lab:
        "The sword is applied heat — the operation of calcination / opening " +
        "the body so the solvent can act. In the lab this is the furnace fire, " +
        "graded by degrees: dung-heat, water-bath, ash, then open coals.",
      cite: "De Jong 1969; operation = CALCINATION, stage = NIGREDO (Claudiens db)",
    },
    {
      title: "Cautiously — the regulation of heat",
      symbol: "caute percute",
      focus: "athanor",
      discourse:
        "“Attack it cautiously.” The philosophers prefer the moderate warmth " +
        "by which an egg is hatched: expel the first moisture with a gentle " +
        "fire, then close the retort tightly when the fire is intensified, " +
        "lest the volatile spirit escape.",
      lab:
        "This is the entire practical lesson, and the reason the athanor " +
        "exists: a self-feeding tower furnace ('Lazy Henry') giving a low, " +
        "steady heat for days. Too little fire leaves the matter inert; too " +
        "much destroys the embryonic spirit.",
      cite: "Turba (in De Jong 1969); Bilak in Moran (ed.), Cultural History of Chemistry",
    },
    {
      title: "Mars assists Vulcan — iron and fire",
      symbol: "Mars · Vulcanus",
      focus: "crucible",
      discourse:
        "“Let Mars assist Vulcan.” Basil Valentine: Mercury is locked in gaol " +
        "by Vulcan at the order of Mars, freed only when crushed and dead — " +
        "the putrefactio.",
      lab:
        "Vulcan is fire; Mars is iron. The concrete procedure Newman and " +
        "Principe reconstructed: crude antimony ore (stibnite) is fused with " +
        "iron in a crucible, the iron stripping its sulphur to free the bright " +
        "metallic 'star regulus' of antimony — later joined to mercury to make " +
        "the 'sophic mercury.'",
      cite: "Newman, Gehennical Fire; Principe, Secrets of Alchemy (2013), p.162",
    },
    {
      title: "The Bird — the conqueror of iron and fire",
      symbol: "avis · the product",
      focus: "egg",
      discourse:
        "“The bird arising from it will be a conqueror of iron and fire,” born " +
        "as water passes into air, air into fire, fire into earth — the " +
        "circulation of the elements inside the closed egg.",
      lab:
        "The product appears as a sequence of colours in the vessel — the " +
        "visible progress of the Work: black (nigredo) → white (albedo) → " +
        "yellow (citrinitas) → red (rubedo), the Stone.",
      cite: "De Jong 1969 (rotation of elements); Sheppard, Ambix 1958 (colour sequence)",
    },
  ],

  // The colour sequence used by the lab digestion operation
  stages: [
    { key: "prima", label: "Prima materia", color: 0xece2cb, glow: 0x3a3220 },
    { key: "nigredo", label: "Nigredo — the black crow", color: 0x14110c, glow: 0x271a10 },
    { key: "albedo", label: "Albedo — the white swan", color: 0xeef0ea, glow: 0x9fb0c0 },
    { key: "citrinitas", label: "Citrinitas — the yellow", color: 0xe8c64a, glow: 0xffd86a },
    { key: "rubedo", label: "Rubedo — the red king", color: 0xb02218, glow: 0xff5436 },
  ],
};

// Labels for the lab apparatus (used for in-world plaques / focus captions)
export const LAB_LABELS = {
  athanor: "Athanor — the self-feeding tower furnace ('Lazy Henry')",
  reverb: "Reverberatory furnace — flame driven down onto the charge",
  still: "Cucurbit & alembic — wet distillation to the receiver",
  pelican: "Pelican — circulatory reflux of a single charge",
  retort: "Retort — distillation of corrosive spirits",
  aludel: "Aludel — stacked pots for sublimation",
  balneum: "Balneum Mariae — the gentle water-bath of Maria the Jewess",
  crucible: "Hessian crucible — fusion of stibnite + iron → star regulus",
  mortar: "Bronze mortar & pestle — trituration of the ore",
  bench: "Work table — staging, luting, the laboratory notebook",
  egg: "The philosophical egg — sealed for the digestion",
};

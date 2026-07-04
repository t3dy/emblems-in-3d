// ===========================================================================
// locations.js — a coarse "setting" archetype per Atalanta Fugiens emblem,
// read directly off Maier's own epigram/motto text (the same text catalogued
// in emblemdata.js) rather than invented: e.g. Emblem III's "go to the woman
// who washes the sheets" places the scene at a riverside/laundry, Emblem VI's
// "sow your gold in the white foliated earth" places it on a tilled farm,
// Emblem XXII's "then do woman's work, that is to say: cook" places it in a
// kitchen. Where the emblem's own text names no ordinary place (most of the
// later, more abstractly-diagrammatic emblems, XVII on), the setting falls
// back to "laboratory" or "hillside" per the nearest reading in de Jong
// (1969) of what a physical restaging of that emblem's action would need.
//
// This does not replace the props.js visual_elements system (the symbolic
// figures/creatures/apparatus tags stay authoritative); it adds a background
// layer of ordinary architecture and landscape so each of the 51 dioramas
// sits in a place, not a void — the "farms, laboratories, kitchens,
// goldmaking equipment, hills, castles" the emblems are actually set in.
// ===========================================================================

export const LOCATION = {
  "0": "library", "1": "hillside", "2": "farm", "3": "riverside", "4": "garden",
  "5": "cottage", "6": "farm", "7": "hillside", "8": "courtyard", "9": "garden",
  "10": "laboratory", "11": "library", "12": "library", "13": "riverside", "14": "cave",
  "15": "workshop", "16": "courtyard", "17": "laboratory", "18": "laboratory", "19": "laboratory",
  "20": "garden", "21": "courtyard", "22": "kitchen", "23": "temple", "24": "laboratory",
  "25": "hillside", "26": "garden", "27": "garden", "28": "bathhouse", "29": "laboratory",
  "30": "laboratory", "31": "seaside", "32": "seaside", "33": "laboratory", "34": "bathhouse",
  "35": "farm", "36": "hillside", "37": "laboratory", "38": "hillside", "39": "hillside",
  "40": "laboratory", "41": "garden", "42": "library", "43": "hillside", "44": "temple",
  "45": "courtyard", "46": "hillside", "47": "hillside", "48": "castle", "49": "hillside",
  "50": "hillside",
};

// Each setting places 2-4 background props (existing props.js tags, reused
// so no new prop code is needed) around the far edge of the diorama —
// outside the central symbolic staging so they read as "the place this
// happens" rather than competing with the emblem's own figures/apparatus.
//
// `floor` names a procedural ground texture (textures.js) so the surface
// itself reads as tilled soil, grass, flagstone, sand, wood, or worked stone
// instead of a flat-shaded plane — the same idea as the Emblem VIII
// flagship's tiled-checker floor, generalized per setting.
export const SETTINGS = {
  library:    { ground: 0x5c5238, floor: "wood",   backdrop: [{ tag: "classical_architecture", x: -8, z: -7 }, { tag: "classical_columns", x: 8, z: -7 }] },
  hillside:   { ground: 0x6a6150, floor: "grass",  backdrop: [{ tag: "mountain", x: -9, z: -8 }, { tag: "mountain", x: 9, z: -9 }, { tag: "tree", x: -5, z: -9 }] },
  farm:       { ground: 0x7a6a3e, floor: "soil",   backdrop: [{ tag: "white_earth", x: -7, z: -7 }, { tag: "white_earth", x: 7, z: -8 }, { tag: "classical_architecture", x: 0, z: -9 }] },
  riverside:  { ground: 0x6a6150, floor: "grass",  backdrop: [{ tag: "water", x: 0, z: -8, scale: 2.4 }, { tag: "tree", x: -8, z: -7 }] },
  garden:     { ground: 0x596b45, floor: "grass",  backdrop: [{ tag: "tree", x: -8, z: -7 }, { tag: "tree", x: 8, z: -8 }, { tag: "garden_walls", x: 0, z: -9 }] },
  cottage:    { ground: 0x6a6150, floor: "wood",   backdrop: [{ tag: "classical_architecture", x: 0, z: -8 }, { tag: "tree", x: -8, z: -6 }] },
  courtyard:  { ground: 0x6a6150, floor: "cobble", backdrop: [{ tag: "classical_columns", x: -8, z: -8 }, { tag: "classical_columns", x: 8, z: -8 }] },
  laboratory: { ground: 0x554d3e, floor: "cobble", backdrop: [{ tag: "furnace", x: -8, z: -7 }, { tag: "vessel", x: 8, z: -7 }] },
  cave:       { ground: 0x3a3428, floor: "stone",  backdrop: [{ tag: "mountain", x: 0, z: -8, scale: 1.5 }] },
  workshop:   { ground: 0x554d3e, floor: "cobble", backdrop: [{ tag: "kiln", x: -8, z: -7 }, { tag: "clay_vessel", x: 8, z: -7 }] },
  kitchen:    { ground: 0x6a6150, floor: "wood",   backdrop: [{ tag: "fire", x: -8, z: -7 }, { tag: "table", x: 8, z: -7 }, { tag: "classical_architecture", x: 0, z: -9 }] },
  temple:     { ground: 0x6a6150, floor: "cobble", backdrop: [{ tag: "classical_columns", x: -8, z: -7 }, { tag: "classical_columns", x: 0, z: -8 }, { tag: "classical_columns", x: 8, z: -7 }] },
  bathhouse:  { ground: 0x5a6068, floor: "cobble", backdrop: [{ tag: "water", x: 0, z: -8, scale: 1.8 }, { tag: "classical_columns", x: -8, z: -7 }] },
  seaside:    { ground: 0x555048, floor: "sand",   backdrop: [{ tag: "water", x: 0, z: -6, scale: 4 }, { tag: "mountain", x: -9, z: -9 }] },
  castle:     { ground: 0x6a6150, floor: "cobble", backdrop: [{ tag: "classical_architecture", x: -8, z: -8 }, { tag: "classical_architecture", x: 8, z: -8 }, { tag: "classical_columns", x: 0, z: -9 }] },
};

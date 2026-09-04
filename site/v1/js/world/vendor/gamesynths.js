// ===========================================================================
// gamesynths.js — ten NES "synth palettes", one per iconic game + level, drawn
// from nsfripper's CODEXSYNTH bench (Mario, Zelda, Metroid, Castlevania, Contra,
// Final Fantasy, Kirby, Bubble Bobble, Bionic Commando, Wizards & Warriors).
//
// Each palette retunes the chiptune engine's three channels (two pulse + the
// triangle bass) to evoke that game's voice: duty cycle, ADSR, vibrato, gain.
// The fugue cycles through all ten as it repeats — ten versions of every emblem.
// ===========================================================================

// channel = { duty(0..1, ignored for tri), a, d, s, r, gain, vib (cents), vibHz }
const ch = (duty, a, d, s, r, gain, vib = 0, vibHz = 5.5) => ({ duty, a, d, s, r, gain, vib, vibHz });

export const GAME_PALETTES = [
  {
    id: "mario", game: "Super Mario Bros.", level: "Overworld (1-1)",
    blurb: "Koji Kondo's bright, bouncing calypso: snappy 25%-duty leads over a walking triangle bass. Quick decays, almost no sustain — every note pops and lets go.",
    p1: ch(0.5, 0.004, 0.04, 0.35, 0.06, 0.30), p2: ch(0.25, 0.004, 0.05, 0.30, 0.06, 0.24), tri: ch(0, 0.004, 0.02, 0.9, 0.08, 0.5),
  },
  {
    id: "zelda", game: "The Legend of Zelda", level: "Overworld Theme",
    blurb: "Heroic and sustained — broad 50%-duty leads that ring, with a steady triangle and a touch of vibrato on long notes. Marching, adventurous.",
    p1: ch(0.5, 0.006, 0.06, 0.7, 0.12, 0.30, 14, 5), p2: ch(0.5, 0.006, 0.08, 0.6, 0.12, 0.22, 10, 5), tri: ch(0, 0.005, 0.03, 0.95, 0.1, 0.5),
  },
  {
    id: "metroid", game: "Metroid", level: "Brinstar",
    blurb: "Eerie and cavernous: thin 12.5%-duty voices with long releases and heavy vibrato, a hollow triangle beneath. Lonely, subterranean.",
    p1: ch(0.125, 0.01, 0.1, 0.6, 0.25, 0.26, 22, 6.5), p2: ch(0.125, 0.02, 0.12, 0.5, 0.3, 0.2, 26, 6.5), tri: ch(0, 0.02, 0.1, 0.85, 0.2, 0.46),
  },
  {
    id: "castlevania", game: "Castlevania", level: "Vampire Killer",
    blurb: "Driving gothic rock: punchy 25%-duty stabs, fast attack, tight release, an insistent triangle bassline. Relentless forward motion.",
    p1: ch(0.25, 0.003, 0.05, 0.45, 0.05, 0.30), p2: ch(0.25, 0.003, 0.06, 0.4, 0.05, 0.24, 8, 6), tri: ch(0, 0.003, 0.02, 0.95, 0.05, 0.55),
  },
  {
    id: "contra", game: "Contra", level: "Jungle",
    blurb: "Aggressive run-and-gun: bold 50%-duty leads, hard attack, short sustain, a pumping bass. All adrenaline.",
    p1: ch(0.5, 0.002, 0.04, 0.4, 0.05, 0.32), p2: ch(0.25, 0.003, 0.05, 0.35, 0.05, 0.26), tri: ch(0, 0.002, 0.02, 0.95, 0.05, 0.55),
  },
  {
    id: "final_fantasy", game: "Final Fantasy", level: "Prelude",
    blurb: "Nobuo Uematsu's cascading harp arpeggio rendered as gentle, long 50%-duty tones with soft attack and generous sustain — crystalline and weightless.",
    p1: ch(0.5, 0.02, 0.1, 0.8, 0.2, 0.26, 8, 4.5), p2: ch(0.5, 0.03, 0.12, 0.75, 0.2, 0.2, 8, 4.5), tri: ch(0, 0.02, 0.05, 0.95, 0.18, 0.46),
  },
  {
    id: "kirby", game: "Kirby's Adventure", level: "Green Greens",
    blurb: "Cheerful and round: bouncy 25%-duty melody with a plump triangle, medium decays — playful and warm.",
    p1: ch(0.25, 0.005, 0.05, 0.5, 0.08, 0.30, 6), p2: ch(0.5, 0.006, 0.06, 0.45, 0.08, 0.22), tri: ch(0, 0.005, 0.03, 0.92, 0.09, 0.52),
  },
  {
    id: "bubble_bobble", game: "Bubble Bobble", level: "Main Theme",
    blurb: "Endlessly catchy and staccato: tiny 12.5%-duty blips, very short notes, springy bass. Toy-like and hyperactive.",
    p1: ch(0.125, 0.002, 0.03, 0.2, 0.04, 0.30), p2: ch(0.25, 0.002, 0.03, 0.2, 0.04, 0.24), tri: ch(0, 0.002, 0.02, 0.9, 0.04, 0.5),
  },
  {
    id: "bionic_commando", game: "Bionic Commando", level: "Area 1",
    blurb: "Funky and synthetic: fat 50%-duty leads with a little vibrato swagger, punchy bass — proto-techno NES groove.",
    p1: ch(0.5, 0.004, 0.06, 0.55, 0.08, 0.30, 12, 5.5), p2: ch(0.25, 0.004, 0.07, 0.5, 0.08, 0.24, 10, 5.5), tri: ch(0, 0.004, 0.03, 0.95, 0.08, 0.55),
  },
  {
    id: "wizards_and_warriors", game: "Wizards & Warriors", level: "Forest of Elrond",
    blurb: "Stately fantasy fanfare: broad 50%-duty voices, slow vibrato, long ringing sustain — regal and woodland-bright.",
    p1: ch(0.5, 0.008, 0.08, 0.75, 0.16, 0.29, 16, 4.8), p2: ch(0.5, 0.01, 0.1, 0.7, 0.16, 0.22, 14, 4.8), tri: ch(0, 0.006, 0.04, 0.95, 0.12, 0.5),
  },
];

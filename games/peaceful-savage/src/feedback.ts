import type { EffectName } from "./audio.ts";
import type { NewsKind } from "./rules/types.ts";

// What the player hears when something happens in the run: one effect for each kind of news the rules give (or nothing, for a step that
// the screen already shows).
const sounds: Readonly<Partial<Record<NewsKind, EffectName>>> = {
  "beat-good": "good",
  "beat-miss": "miss",
  "beat-perfect": "beat",
  "breath-in": "breathIn",
  "breath-miss": "miss",
  "breath-out": "breathOut",
  clue: "gather",
  deck: "gather",
  drawer: "found",
  found: "found",
  healed: "healed",
  jackets: "woven",
  lamp: "lamp",
  level: "level",
  lit: "lit",
  made: "made",
  mastered: "level",
  mirror: "healed",
  pancakes: "gather",
  plasma: "plasma",
  power: "level",
  reflected: "healed",
  relic: "gather",
  rise: "rise",
  sparky: "sparky",
  thing: "thing",
  thread: "gather",
  touch: "touch",
  tricked: "tricked",
  vision: "vision",
};

export const soundOf = (kind: NewsKind): EffectName | null =>
  sounds[kind] ?? null;

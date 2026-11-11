import type { EffectName } from "./audio.ts";
import type { Happening, HappeningKind } from "./rules/types.ts";

// What the speakers play for each thing the rules say happened, and whether it is the one moment the screen flashes orange: a crystal's
// take, and nothing else. The 3D screen and the flat one both ask here, so the game sounds the same whichever draws it.
export interface Cue {
  readonly sfx: EffectName | null;
  readonly flash: boolean;
}

const sounds: Readonly<Record<HappeningKind, EffectName | null>> = {
  bolt: "bolt",
  burst: "burst",
  cage: "breakOpen",
  crate: "breakOpen",
  crush: "crush",
  dart: "dart",
  "free-hit": "freeHit",
  grow: "grow",
  hit: "hit",
  hop: "hop",
  land: "land",
  plunge: "splash",
  roll: "roll",
  "round-clear": "roundClear",
  "round-end": null,
  "round-start": "roundStart",
  shatter: "shatter",
  splash: "splash",
  take: null,
  vision: "vision",
};

const takes: readonly EffectName[] = ["crystal", "egg", "key"];

export const cueOf = ({ detail, kind }: Happening): Cue =>
  kind === "take"
    ? { flash: detail === 0, sfx: takes[detail] ?? null }
    : { flash: false, sfx: sounds[kind] };

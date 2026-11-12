import type { HeroId } from "./constants.ts";

// What each of the family brings when they lead a run. Each stat is one to five and changes the rules a little: speed is how fast they
// walk, calm how much give a breath has, vision how long and how far Savage Vision shows, heart how much give a beat has. Kai locks
// in the groove, so his perfect beats have a tick more.
export interface Stats {
  readonly calm: number;
  readonly heart: number;
  readonly speed: number;
  readonly vision: number;
}

export const stats: Readonly<Record<HeroId, Stats>> = {
  ali: { calm: 2, heart: 5, speed: 5, vision: 2 },
  heerah: { calm: 5, heart: 3, speed: 3, vision: 3 },
  kai: { calm: 3, heart: 3, speed: 4, vision: 4 },
  zora: { calm: 3, heart: 3, speed: 3, vision: 5 },
};

export const grooveBonus: Readonly<Record<HeroId, number>> = {
  ali: 0,
  heerah: 0,
  kai: 1,
  zora: 0,
};

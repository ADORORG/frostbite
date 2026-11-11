import type { LeadId } from "./rules/leads.ts";
import type { ItemKind } from "./rules/types.ts";

// Every word the player reads, in one place.
export interface HeroWords {
  readonly name: string;
  readonly kind: string;
  readonly signature: string;
  readonly story: string;
}

export const heroWords: Record<LeadId, HeroWords> = {
  hrimm: {
    kind: "Ice giant",
    name: "Hrimm",
    signature:
      "Thick hide: a hit costs three seconds, not five, and barely moves him.",
    story:
      "The giant of the far floe, slow to start and impossible to stop. His crown of spires hums when the aurora is near.",
  },
  lumen: {
    kind: "Spirit miner",
    name: "Lumen",
    signature:
      "Lantern light: takes treasure from further off and sees through frost for longer.",
    story:
      "A miner's spirit whose lamp never went out. Lumen still digs the old ice for crystals, humming a tune nobody else remembers.",
  },
  nib: {
    kind: "Baby dragon",
    name: "Nib",
    signature:
      "Soft wings: the longest glide, and frost bolts that fly further.",
    story:
      "Hatched under the aurora this morning. Nib's wings are still soft as new frost, and every sneeze is a spark.",
  },
  pip: {
    kind: "Snow creature",
    name: "Pip",
    signature: "Lucky scarf: the first hit of every round costs nothing.",
    story:
      "A round little snow creature with two stubby feet and a scarf knitted by the wind. Small, quick, and lucky.",
  },
  volt: {
    kind: "Neon holographic ram",
    name: "Volt",
    signature:
      "Light charge: rolls fastest, and a rolling charge breaks even the giant snowballs.",
    story:
      "A ram of living light who stepped out of an old arcade sign one winter night and never went back in.",
  },
};

export const roundWords = [
  { learn: "Move · Hop · Duck", name: "The Floe" },
  { learn: "Roll · Shoot · Hover", name: "The Sound" },
  { learn: "Grow · Frost vision", name: "The Crown" },
] as const;

export const kindWords: Record<
  ItemKind,
  { readonly one: string; readonly many: string }
> = {
  crystal: { many: "Crystals", one: "Crystal" },
  egg: { many: "Eggs", one: "Egg" },
  key: { many: "Keys", one: "Key" },
};

export const statNames = [
  "Speed",
  "Hop",
  "Glide",
  "Toughness",
  "Power",
] as const;

export const words = {
  brand: "FROST·BITE",
  changeHero: "Change hero",
  choose: "Choose your hero",
  cleared: "Swept clean",
  connected: "Connected.",
  goal: "Win the run: take 90% of every treasure across three rounds.",
  holdHint: "Long-press or right-click the card to save it.",
  lose: "So close",
  loading: "Thawing the floe…",
  next: "Next",
  flat: "This browser cannot draw in 3D, so the run is drawn flat from above.",
  offline: "Playing outside the platform. Nothing is saved.",
  playAgain: "Play again",
  startRun: "Start run",
  swipe: "Swipe to choose · Tap to play",
  tapAgain: "Tap anywhere to play again",
  playAs: (name: string): string => `Play as ${name}`,
  previous: "Previous",
  round: (index: number): string => `Round ${String(index + 1)}`,
  roundOf: (index: number): string => `Round ${String(index + 1)} of 3`,
  share: "Share card",
  shareSquare: "Square",
  shareStory: "Story",
  close: "Close",
  timeUp: "Time!",
  title: "Frost Run",
  win: "Frost Run won",
} as const;

export const touchLabels = {
  duck: "DUCK",
  grow: "GROW",
  hop: "HOP",
  see: "SEE",
  shoot: "SHOOT",
} as const;

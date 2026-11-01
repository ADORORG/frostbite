import type { Plasma } from "../plasma.ts";

// The shape of the guild's quest: where Glitchy is, what the guild has done, and a cheer challenge when one is going on.
export interface Spot {
  readonly x: number;
  readonly y: number;
}

export type Facing = "down" | "left" | "right" | "up";
// The ways, `act` and `fire`, and in a cheer challenge the hotkeys: a show by its number (1 to 5), a quick cheer, evade, and a charm.
export type CastleControl =
  | "act"
  | "charm"
  | "down"
  | "evade"
  | "fire"
  | "left"
  | "quick"
  | "right"
  | "show1"
  | "show2"
  | "show3"
  | "show4"
  | "show5"
  | "up";
export const castleControls: readonly CastleControl[] = [
  "left",
  "right",
  "up",
  "down",
  "act",
  "fire",
  "show1",
  "show2",
  "show3",
  "show4",
  "show5",
  "quick",
  "evade",
  "charm",
];

export interface Battle {
  // The keeper's last grumble attack (by its place in the keeper's list; -1 before the first) and whether it missed (evaded or blocked).
  readonly attack: number;
  readonly dodged: boolean;
  // The guild is evading the next grumble; a quick cheer keeps the next one small; the shield charm blocks this many; the star charm
  // makes the next show three times as strong.
  readonly evading: boolean;
  readonly gentle: boolean;
  readonly shield: number;
  readonly star: boolean;
  // The move picked in the menu, by its place in the list of moves the guild has.
  readonly choice: number;
  // Whether the first move against this keeper was its favourite (null before the first move).
  readonly firstFavourite: boolean | null;
  readonly foe: number;
  readonly grumble: number;
  // The last move used, by its place in the list of all moves (-1 for none): the same move twice running is too tired to work.
  readonly last: number;
  // The move shown and the reply that follows it, for the screen.
  readonly lastHit: number;
  readonly lastReply: number;
  readonly phase: "choose" | "show";
  readonly since: number;
  readonly spirit: number;
}

export interface Message {
  readonly id: string;
  readonly tick: number;
}

export interface CastleState {
  readonly bannerRaised: boolean;
  readonly battle: Battle | null;
  // The secret charms found on the map (spirit, star, shield) and those used up in challenges.
  readonly charms: readonly boolean[];
  readonly charmsUsed: readonly boolean[];
  readonly cheered: readonly boolean[];
  readonly controls: Readonly<Record<CastleControl, boolean>>;
  readonly crossedRiver: boolean;
  readonly ended: boolean;
  readonly escapedWoods: boolean;
  // Grumbles the guild evaded.
  readonly evades: number;
  readonly facing: Facing;
  // Each keeper's favourite move, laid out from the seed.
  readonly favourites: readonly number[];
  readonly finishTick: number | null;
  readonly fireTick: number;
  readonly friends: readonly boolean[];
  // Hearts left, and hearts lost in the run (in the quest, the level starts with the hearts the one before ended with).
  readonly hearts: number;
  readonly heartsLost: number;
  readonly held: readonly boolean[];
  readonly melted: boolean;
  readonly message: Message | null;
  readonly naps: number;
  readonly opened: readonly boolean[];
  readonly perfectPicks: number;
  readonly plasma: Plasma;
  readonly pushed: readonly boolean[];
  readonly lilies: boolean;
  readonly rng: number;
  readonly seed: number;
  // The tile stepped from and the tick the step began, while Glitchy walks to (x, y).
  readonly step: { readonly from: Spot; readonly start: number } | null;
  readonly taken: readonly boolean[];
  readonly tick: number;
  readonly trail: readonly Spot[];
  readonly x: number;
  readonly y: number;
}

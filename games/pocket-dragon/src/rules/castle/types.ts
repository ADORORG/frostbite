import type { Powers, TileBlast } from "../kit.ts";
import type { Plasma } from "../plasma.ts";

// The shape of the guild's quest: where Glitchy is, what the guild has done, and a cheer challenge when one is going on.
export interface Spot {
  readonly x: number;
  readonly y: number;
}

export type Facing = "down" | "left" | "right" | "up";
// The ways, `act` and `fire`, the backpack's three foods, and in a cheer challenge the hotkeys: a show by its number (1 to 5), a quick
// cheer, evade, and a charm.
export type CastleControl =
  | "act"
  | "berry"
  | "charm"
  | "down"
  | "evade"
  | "fire"
  | "left"
  | "mushroom"
  | "pineapple"
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
  "berry",
  "mushroom",
  "pineapple",
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

// The guild's level has three parts, each with its own look: the day (gather the guild), the night (save the eggs from DeFu's
// security guards) and the winter (storm the castle for the Legendary Golden Egg).
export type Phase = "day" | "night" | "winter";

// An egg of the night: where it is, and whether it lies loose, is carried off by a guard, sits in the guards' cage, or has been saved.
export interface NightEgg {
  readonly state: "caged" | "carried" | "loose" | "saved";
  readonly x: number;
  readonly y: number;
}

// A security guard of the night: where it stands, the egg it carries (-1 for none), the ticks it stays dizzy, and when it last stepped.
export interface NightGuard {
  readonly carrying: number;
  readonly dizzy: number;
  readonly moved: number;
  readonly x: number;
  readonly y: number;
}

export interface Message {
  readonly id: string;
  readonly tick: number;
}

export interface CastleState {
  readonly battle: Battle | null;
  // A glitch blast rolling over the land (`powers.ts`).
  readonly blast: TileBlast | null;
  // The secret charms found on the map (spirit, star, shield) and those used up in challenges.
  readonly charms: readonly boolean[];
  readonly charmsUsed: readonly boolean[];
  readonly cheered: readonly boolean[];
  // The clues read in the houses (three open the castle gate in winter).
  readonly clues: readonly boolean[];
  readonly controls: Readonly<Record<CastleControl, boolean>>;
  readonly crossedRiver: boolean;
  // The night's eggs (none before night falls).
  readonly eggs: readonly NightEgg[];
  readonly ended: boolean;
  readonly escapedWoods: boolean;
  // Grumbles the guild evaded.
  readonly evades: number;
  readonly facing: Facing;
  // Each keeper's favourite move, laid out from the seed.
  readonly favourites: readonly number[];
  readonly finishTick: number | null;
  readonly fireTick: number;
  // Ticks of the forcefield left, and whether its bubble has been taken.
  readonly forcefield: number;
  readonly forceTaken: boolean;
  readonly friends: readonly boolean[];
  readonly gateOpen: boolean;
  // The gear found in the houses: swift boots, the cheer cape, the ember helm.
  readonly gear: readonly boolean[];
  // The Legendary Golden Egg has been taken from the throne: the level is won.
  readonly goldenEgg: boolean;
  readonly guards: readonly NightGuard[];
  // Hearts left, and hearts lost in the run (in the quest, the level starts with the hearts the one before ended with).
  readonly hearts: number;
  readonly heartsLost: number;
  readonly held: readonly boolean[];
  // Ticks Glitchy blinks after a bump, when no other bump counts.
  readonly invulnerable: number;
  // Which of the backpack's foods on the map have been picked up, and the backpack with what it does (`../kit.ts`).
  readonly kitTaken: readonly boolean[];
  readonly melted: boolean;
  readonly message: Message | null;
  readonly naps: number;
  readonly opened: readonly boolean[];
  readonly perfectPicks: number;
  readonly phase: Phase;
  // The tick the phase began.
  readonly phaseTick: number;
  readonly plasma: Plasma;
  readonly powers: Powers;
  readonly pushed: readonly boolean[];
  readonly lilies: boolean;
  readonly rng: number;
  // The house Glitchy is inside (by its place in `doors`), or -1 outdoors.
  readonly room: number;
  readonly seed: number;
  // The tile stepped from and the tick the step began, while Glitchy walks to (x, y).
  readonly step: { readonly from: Spot; readonly start: number } | null;
  // Guards left dizzy with a puff of fire.
  readonly stuns: number;
  readonly taken: readonly boolean[];
  readonly tick: number;
  readonly trail: readonly Spot[];
  readonly x: number;
  readonly y: number;
}

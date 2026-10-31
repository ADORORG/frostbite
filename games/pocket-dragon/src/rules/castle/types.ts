// The shape of the guild's quest: where Glitchy is, what the guild has done, and a cheer challenge when one is going on.
export interface Spot {
  readonly x: number;
  readonly y: number;
}

export type Facing = "down" | "left" | "right" | "up";
export type CastleControl = "act" | "down" | "fire" | "left" | "right" | "up";
export const castleControls: readonly CastleControl[] = [
  "left",
  "right",
  "up",
  "down",
  "act",
  "fire",
];

export interface Battle {
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
  readonly cheered: readonly boolean[];
  readonly controls: Readonly<Record<CastleControl, boolean>>;
  readonly crossedRiver: boolean;
  readonly ended: boolean;
  readonly escapedWoods: boolean;
  readonly facing: Facing;
  // Each keeper's favourite move, laid out from the seed.
  readonly favourites: readonly number[];
  readonly finishTick: number | null;
  readonly fireTick: number;
  readonly friends: readonly boolean[];
  readonly held: readonly boolean[];
  readonly melted: boolean;
  readonly message: Message | null;
  readonly naps: number;
  readonly opened: readonly boolean[];
  readonly perfectPicks: number;
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

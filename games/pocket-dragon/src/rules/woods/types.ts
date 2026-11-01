import type { Mote, Plasma } from "../plasma.ts";

// The shape of the woods (laid out from the seed and never changed) and the walk through them.
export interface Place {
  // A cell, by column and row.
  readonly x: number;
  readonly y: number;
}

// A target in the launch round, in field units: hitting it with an egg scores `value`.
export interface Target {
  readonly height: number;
  readonly value: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface WoodsLevel {
  readonly charms: readonly Place[];
  readonly chests: readonly Place[];
  readonly clues: readonly Place[];
  // The cell of frozen hedge in front of the moon chest, and the cell of the moon gate, by `y * size + x`.
  readonly frozen: number;
  readonly gate: number;
  readonly eggs: readonly Place[];
  readonly lanterns: readonly Place[];
  readonly moonChest: Place;
  // Metaplasma, sorted by `x`, in the woods' units (256 to a cell).
  readonly motes: readonly Mote[];
  readonly parts: readonly Place[];
  readonly targets: readonly Target[];
  readonly start: {
    readonly angle: number;
    readonly x: number;
    readonly y: number;
  };
  // What each cell holds (`open`, `tree`, `frozen`, `gate`), by `y * size + x`.
  readonly walls: readonly number[];
}

export type WoodsControl = "down" | "fire" | "left" | "right" | "up";
export const woodsControls: readonly WoodsControl[] = [
  "left",
  "right",
  "up",
  "down",
  "fire",
];

// The last thing found, and the tick it was found on, for the screen and the sounds.
export interface Found {
  readonly kind:
    | "charm"
    | "chest"
    | "clue"
    | "egg"
    | "lantern"
    | "launcher"
    | "melt"
    | "moon"
    | "part";
  readonly tick: number;
}

// The launch round: the launcher's tilt and power, the eggs left, the egg in the air, the score and the hits on each target.
export interface Launch {
  readonly aim: number;
  readonly ended: boolean;
  readonly eggsLeft: number;
  readonly flying: {
    readonly vx: number;
    readonly vy: number;
    readonly x: number;
    readonly y: number;
  } | null;
  readonly hits: readonly number[];
  readonly last: { readonly target: number; readonly tick: number } | null;
  readonly power: number;
  readonly score: number;
  readonly start: number;
}

export interface WoodsState {
  readonly angle: number;
  // The tick of the last breath of fire, for the screen (-1 before the first).
  readonly breathTick: number;
  readonly breaths: number;
  // The secret charms found (swift, sight, magnet, in the level's order), the launcher's parts and the eggs picked up.
  readonly charms: readonly boolean[];
  readonly chests: readonly boolean[];
  readonly clues: readonly boolean[];
  readonly controls: Readonly<Record<WoodsControl, boolean>>;
  readonly eggs: readonly boolean[];
  readonly ended: boolean;
  readonly escaped: boolean;
  readonly finishTick: number | null;
  readonly fireCooldown: number;
  readonly found: Found | null;
  readonly lanterns: readonly boolean[];
  readonly launch: Launch | null;
  readonly level: WoodsLevel;
  readonly melted: boolean;
  readonly moonChest: boolean;
  readonly parts: readonly boolean[];
  readonly plasma: Plasma;
  readonly seed: number;
  readonly tick: number;
  // The cells Glitchy has walked through, for the map.
  readonly visited: readonly boolean[];
  readonly x: number;
  readonly y: number;
}

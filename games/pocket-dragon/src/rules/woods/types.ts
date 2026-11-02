import type { Facing, Spot } from "../grid.ts";
import type { Mote, Plasma } from "../plasma.ts";

// The shape of the woods (laid out from the seed and never changed) and the walk through them.
export interface Place {
  // A cell, by column and row.
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
  readonly start: {
    readonly angle: number;
    readonly x: number;
    readonly y: number;
  };
  // What each cell holds (`open`, `tree`, `frozen`, `gate`), by `y * size + x`.
  readonly walls: readonly number[];
}

export type WoodsControl = "act" | "down" | "fire" | "left" | "right" | "up";
export const woodsControls: readonly WoodsControl[] = [
  "left",
  "right",
  "up",
  "down",
  "fire",
  "act",
];

// The last thing found (or done, out of the maze), and the tick it was found on, for the screen and the sounds.
export type FoundKind =
  | "ally"
  | "bubble"
  | "charm"
  | "chest"
  | "clue"
  | "egg"
  | "freed"
  | "heart"
  | "home"
  | "key"
  | "lantern"
  | "launcher"
  | "melt"
  | "moon"
  | "panel"
  | "part"
  | "shielded"
  | "valve";
export interface Found {
  readonly kind: FoundKind;
  readonly tick: number;
}

// Out of the maze, seen from above: a guard of the woods (on its way to one end of its route, dizzy for a while once hit), a shadow
// dragon of DeFu's, and an egg thrown by the launcher.
export interface BaseGuard {
  readonly dizzy: number;
  readonly moved: number;
  readonly route: number;
  readonly toward: 0 | 1;
  readonly x: number;
  readonly y: number;
}

export interface Shadow {
  readonly moved: number;
  readonly x: number;
  readonly y: number;
}

export interface Flight {
  readonly dx: number;
  readonly dy: number;
  readonly left: number;
  readonly moved: number;
  readonly x: number;
  readonly y: number;
}

// DeFu's laser, aimed at the row (or the column) Glitchy was on when it began to glow.
export interface Laser {
  readonly horizontal: boolean;
  readonly line: number;
}

// The walk outside the maze: the dragons freed from the cages (each follows Glitchy, and brings a heart), the eggs left to launch, the
// valves of the factory broken, the guards sent home and the shadow dragons set free, the rocket keys found and fitted, the tick the
// lair began (-1 before), and Glitchy itself, tile by tile.
export interface Base {
  readonly allies: readonly boolean[];
  readonly ammo: number;
  readonly broken: readonly boolean[];
  readonly bubbleTaken: boolean;
  readonly cheered: number;
  readonly facing: Facing;
  readonly fireTick: number;
  readonly flight: Flight | null;
  readonly forcefield: number;
  readonly freed: number;
  readonly guards: readonly BaseGuard[];
  readonly hatched: number;
  readonly heartTaken: boolean;
  readonly installed: readonly boolean[];
  readonly invulnerable: number;
  readonly lairStart: number;
  readonly laser: Laser | null;
  readonly launchTick: number;
  readonly pieces: readonly boolean[];
  readonly shadows: readonly Shadow[];
  readonly step: { readonly from: Spot; readonly start: number } | null;
  readonly trail: readonly Spot[];
  readonly x: number;
  readonly y: number;
}

// A scene that plays (and can be skipped with the action key): out of the maze, into the lair, the rocket defused, the rocket gone.
export type SceneId = "launch" | "lair" | "peace" | "rise";
export interface Scene {
  readonly id: SceneId;
  readonly start: number;
}

export interface WoodsState {
  readonly angle: number;
  // Outside the maze (null while in it).
  readonly base: Base | null;
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
  // The tick Glitchy got out of the maze, and the tick the rocket was defused (null until then).
  readonly escapeTick: number | null;
  readonly finishTick: number | null;
  readonly fireCooldown: number;
  readonly found: Found | null;
  // Hearts left, and hearts lost in the run.
  readonly hearts: number;
  readonly heartsLost: number;
  readonly lanterns: readonly boolean[];
  readonly level: WoodsLevel;
  readonly melted: boolean;
  readonly moonChest: boolean;
  // How the level ended: the rocket defused (won) or launched (lost).
  readonly outcome: "defused" | "launched" | null;
  readonly parts: readonly boolean[];
  readonly plasma: Plasma;
  readonly scene: Scene | null;
  readonly seed: number;
  readonly tick: number;
  // The cells Glitchy has walked through, for the map.
  readonly visited: readonly boolean[];
  readonly x: number;
  readonly y: number;
}

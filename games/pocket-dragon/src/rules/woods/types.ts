// The shape of the woods (laid out from the seed and never changed) and the walk through them.
export interface Place {
  // A cell, by column and row.
  readonly x: number;
  readonly y: number;
}

export interface WoodsLevel {
  readonly chests: readonly Place[];
  readonly clues: readonly Place[];
  // The cell of frozen hedge in front of the moon chest, and the cell of the moon gate, by `y * size + x`.
  readonly frozen: number;
  readonly gate: number;
  readonly lanterns: readonly Place[];
  readonly moonChest: Place;
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
  readonly kind: "chest" | "clue" | "lantern" | "melt" | "moon";
  readonly tick: number;
}

export interface WoodsState {
  readonly angle: number;
  // The tick of the last breath of fire, for the screen (-1 before the first).
  readonly breathTick: number;
  readonly breaths: number;
  readonly chests: readonly boolean[];
  readonly clues: readonly boolean[];
  readonly controls: Readonly<Record<WoodsControl, boolean>>;
  readonly ended: boolean;
  readonly escaped: boolean;
  readonly finishTick: number | null;
  readonly fireCooldown: number;
  readonly found: Found | null;
  readonly lanterns: readonly boolean[];
  readonly level: WoodsLevel;
  readonly melted: boolean;
  readonly moonChest: boolean;
  readonly seed: number;
  readonly tick: number;
  // The cells Glitchy has walked through, for the map.
  readonly visited: readonly boolean[];
  readonly x: number;
  readonly y: number;
}

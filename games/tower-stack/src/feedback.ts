import type { TowerState } from "./rules/types.ts";

// What the player hears for a drop: a tumble if it missed, a thud if it trimmed the block, and a chime (higher for each in a row) if it was
// perfect, with a lift when the tower also grew back.
export type DropSound =
  | { readonly kind: "fall" }
  | { readonly kind: "land" }
  | { readonly kind: "perfect"; readonly streak: number }
  | { readonly kind: "regrow" };

export function dropSounds(
  before: TowerState,
  after: TowerState,
): readonly DropSound[] {
  if (after.over && !before.over) return [{ kind: "fall" }];
  if (after.perfects > before.perfects)
    return [
      { kind: "perfect", streak: after.streak },
      ...(after.width > before.width ? [{ kind: "regrow" } as const] : []),
    ];
  return [{ kind: "land" }];
}

// The music runs faster as the tower climbs, by a fiftieth for each block, up to one and a half times as fast.
export const tempoScale = (height: number): number =>
  Math.min(1.5, 1 + height / 50);

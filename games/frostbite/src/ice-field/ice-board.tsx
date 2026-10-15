import * as React from "react";
import { cells } from "../verifier/ice-field.ts";
import { columns, neighbourMines } from "./neighbours.ts";
import type { IceFieldState } from "../verifier/ice-field.ts";

type TileState = "mine" | "open" | "revealed-mine" | "safe";

function describe(
  state: TileState,
  neighbours: number,
): { label: string; mark: string } {
  switch (state) {
    case "safe":
      return {
        label: `safe, ${String(neighbours)} mines next to it`,
        mark: neighbours === 0 ? "◆" : String(neighbours),
      };
    case "mine":
      return { label: "a mine, you struck it", mark: "✱" };
    case "revealed-mine":
      return { label: "a mine", mark: "✱" };
    case "open":
      return { label: "not picked", mark: "" };
  }
}

// The field of frost tiles. A picked safe tile shows how many mines are next to it; after a mine is struck the rest are
// shown. Every state is in the tile's name, not only in its colour.
export function IceBoard({
  disabled,
  onPick,
  state,
}: {
  readonly disabled: boolean;
  readonly onPick: (tile: number) => void;
  readonly state: IceFieldState;
}) {
  const { busted, mines, picks } = state.board;
  return (
    <div
      aria-label="Ice field"
      className="if-board"
      data-busted={busted ? "true" : undefined}
      role="group"
    >
      {Array.from({ length: cells }, (_, tile) => {
        const picked = picks.includes(tile);
        const mine = mines.includes(tile);
        const tileState: TileState = picked
          ? mine
            ? "mine"
            : "safe"
          : busted && mine
            ? "revealed-mine"
            : "open";
        const { label, mark } = describe(
          tileState,
          neighbourMines(tile, mines),
        );
        return (
          <button
            aria-label={`Tile ${String(tile + 1)} of ${String(cells)}, ${label}`}
            className="if-tile"
            data-row-start={tile % columns === 0 ? "true" : undefined}
            data-state={tileState}
            disabled={disabled || busted || picked}
            key={tile}
            onClick={() => onPick(tile)}
            type="button"
          >
            {mark}
          </button>
        );
      })}
    </div>
  );
}

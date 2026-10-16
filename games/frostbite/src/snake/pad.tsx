import * as React from "react";

import type { Direction } from "../verifier/snake-board.ts";

const arrows: readonly {
  readonly direction: Direction;
  readonly mark: string;
}[] = [
  { direction: "up", mark: "↑" },
  { direction: "left", mark: "←" },
  { direction: "down", mark: "↓" },
  { direction: "right", mark: "→" },
];

// Steering for a touch screen or a mouse; the arrow keys and WASD do the same on a keyboard.
export function SnakePad({
  onTurn,
}: {
  readonly onTurn: (direction: Direction) => void;
}) {
  return (
    <div aria-label="Steer" className="sn-pad" role="group">
      {arrows.map(({ direction, mark }) => (
        <button
          aria-label={`Turn ${direction}`}
          className="if-button sn-pad-key"
          data-direction={direction}
          key={direction}
          onClick={() => onTurn(direction)}
          type="button"
        >
          {mark}
        </button>
      ))}
    </div>
  );
}

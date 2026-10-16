import * as React from "react";

import { gridSize, holds, type Cell } from "../verifier/snake-board.ts";
import type { SnakeState } from "../verifier/snake.ts";

type Kind = "body" | "empty" | "food" | "head" | "mine";

function kindOf(state: SnakeState, cell: Cell): Kind {
  const [head] = state.snake;
  if (head !== undefined && head[0] === cell[0] && head[1] === cell[1])
    return "head";
  if (holds(state.snake, cell)) return "body";
  if (state.food !== null && holds([state.food], cell)) return "food";
  return holds(state.mines, cell) ? "mine" : "empty";
}

const marks: Record<Kind, string> = {
  body: "",
  empty: "",
  food: "◆",
  head: "",
  mine: "☠",
};

// The board: twelve by twelve, the snake's head and body, the food, and the mines, which are in plain view. The cells are
// for the eye; the board as a whole says in words how long the snake is and whether it is still going.
export function SnakeGrid({ state }: { readonly state: SnakeState }) {
  return (
    <div
      aria-label={`Snake board. The snake is ${String(state.snake.length)} long${state.alive ? "" : " and has crashed"}. ${String(state.mines.length)} mines are marked.`}
      className="sn-board"
      data-crashed={state.alive ? undefined : "true"}
      role="img"
    >
      {Array.from({ length: gridSize * gridSize }, (_, index) => {
        const cell: Cell = [index % gridSize, Math.floor(index / gridSize)];
        const kind = kindOf(state, cell);
        return (
          <div
            aria-hidden="true"
            className="sn-cell"
            data-kind={kind}
            key={index}
          >
            {marks[kind]}
          </div>
        );
      })}
    </div>
  );
}

import * as React from "react";
import type { IceFieldState } from "../verifier/ice-field.ts";

// What the player can do with the board they are on, and where they stand. Each button says what it costs or does.
export function IceControls({
  canBuild,
  nextCost,
  onBuild,
  onEnd,
  onSettle,
  state,
}: {
  readonly canBuild: boolean;
  readonly nextCost: number | null;
  readonly onBuild: () => void;
  readonly onEnd: () => void;
  readonly onSettle: () => void;
  readonly state: IceFieldState;
}) {
  return (
    <>
      <dl className="if-stats">
        <div>
          <dt>Board</dt>
          <dd>{state.boardIndex + 1}</dd>
        </div>
        <div>
          <dt>Icicles</dt>
          <dd>{state.icicles}</dd>
        </div>
        <div>
          <dt>Glacier</dt>
          <dd>
            {state.glacierTier === 0
              ? "none"
              : `tier ${String(state.glacierTier)}`}
          </dd>
        </div>
        <div>
          <dt>Boards won</dt>
          <dd>{state.wins}</dd>
        </div>
      </dl>
      <div className="if-actions">
        <button className="if-button" onClick={onSettle} type="button">
          Settle board
        </button>
        <button
          className="if-button"
          disabled={!canBuild}
          onClick={onBuild}
          type="button"
        >
          {nextCost === null
            ? "Every glacier built"
            : `Build glacier (${String(nextCost)} icicles)`}
        </button>
        <button
          className="if-button if-button--quiet"
          onClick={onEnd}
          type="button"
        >
          End run
        </button>
      </div>
    </>
  );
}

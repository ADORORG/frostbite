import { ArcadeActionButton, StatusDot } from "@repo/ui/arcade";
import type { ReactNode } from "react";

import type { Theatre } from "./use-theatre.ts";

// The one slim line above the game: the way back, the title and small facts, whether the game is connected to the platform and where
// the progress is kept (their words are in the title text and hidden on a narrow screen, never dropped), and the two ways to give the
// game more room. Everything stays on one line so the game keeps the rest of the screen.
export function GameBar({
  back,
  connected,
  fullscreen,
  meta,
  saveText,
  theatre,
  title,
}: {
  readonly back?: ReactNode;
  readonly connected: boolean;
  readonly fullscreen: {
    readonly enter: () => void;
    readonly refused: boolean;
    readonly supported: boolean;
  };
  readonly meta?: ReactNode;
  // Where the progress is, said only as far as it is true.
  readonly saveText: string;
  readonly theatre: Theatre;
  readonly title: string;
}) {
  return (
    <>
      {back}
      <h2 className="arcade-stage__title">{title}</h2>
      {meta === undefined ? null : (
        <span className="arcade-stage__facts">{meta}</span>
      )}
      <span className="arcade-stage__status" role="status">
        <StatusDot tone={connected ? "ready" : "attention"} />
        <span className="arcade-stage__status-text">
          {connected ? "Connected to the platform" : "Connecting"}
        </span>
      </span>
      <span className="arcade-stage__save" title={saveText}>
        {saveText}
      </span>
      <span className="arcade-stage__bar-end">
        {fullscreen.refused ? (
          <span role="status">
            The browser did not allow full screen. Try again, or use the
            browser&apos;s own full screen.
          </span>
        ) : null}
        <span className="arcade-stage__hint">
          {theatre.on
            ? "Press Esc to leave theatre."
            : "Press Esc to leave full screen."}
        </span>
        <ArcadeActionButton
          ariaLabel={theatre.on ? "Leave theatre" : "Theatre"}
          onClick={theatre.toggle}
          size="small"
          tone="pink"
        >
          {theatre.on ? "Leave theatre" : "Theatre"}
        </ArcadeActionButton>
        {fullscreen.supported ? (
          <ArcadeActionButton
            onClick={fullscreen.enter}
            size="small"
            tone="cyan"
          >
            Full screen
          </ArcadeActionButton>
        ) : null}
      </span>
    </>
  );
}

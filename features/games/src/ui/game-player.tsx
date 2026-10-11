"use client";

import type { HostedGame } from "@ador/game-sdk/host";
import { ArcadePanel, StatusLamp } from "@repo/ui/arcade";
import { useRef } from "react";

import { useGameSession } from "./use-game-session.ts";

// What the frame may do. Scripts only: no same-origin access, so the game has no storage, cookies or session
// of the platform, no forms, no popups, no top navigation. The response headers for the game's files repeat
// this as a sandbox of their own, so it holds even if the files are opened outside this frame.
export const gameFrameSandbox = "allow-scripts";
export const gameFramePermissions = "fullscreen; autoplay; gamepad";

export function GamePlayer({
  game,
  src,
  title,
}: {
  readonly game: HostedGame;
  readonly src: string;
  readonly title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { connected, kept, unlocked } = useGameSession(game, frame);
  return (
    <>
      <ArcadePanel eyebrow="Playing here" title={title}>
        <StatusLamp
          label={connected ? "Connected to the platform" : "Connecting"}
          tone={connected ? "ready" : "attention"}
        />
        <iframe
          allow={gameFramePermissions}
          data-testid="game-frame"
          ref={frame}
          sandbox={gameFrameSandbox}
          src={src}
          style={{ border: 0, minHeight: "32rem", width: "100%" }}
          title={title}
        />
        <p>
          {kept
            ? "Your progress is kept in this browser."
            : "This browser is blocking storage, so progress will be lost when you leave."}
        </p>
      </ArcadePanel>
      {game.milestones.length === 0 ? null : (
        <ArcadePanel eyebrow="Reported by the game" title="Your milestones">
          <ul aria-label="Your milestones">
            {game.milestones.map((milestone) => (
              <li data-milestone={milestone.id} key={milestone.id}>
                <strong>{milestone.title}</strong>
                <span>
                  {unlocked[milestone.id] === undefined
                    ? " — not yet"
                    : ` — reached ${unlocked[milestone.id]?.slice(0, 10)}`}
                </span>
              </li>
            ))}
          </ul>
          <p>
            The game reports these itself and the platform cannot check them
            yet, so nothing that carries value depends on them.
          </p>
        </ArcadePanel>
      )}
    </>
  );
}

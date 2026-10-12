"use client";

import type { HostedGame } from "@ador/game-sdk/host";
import type { AccountPort, SyncStatus } from "@ador/game-sdk/synced-backend";
import { ArcadePanel, StatusLamp } from "@repo/ui/arcade";
import { useRef } from "react";

import { MilestoneList } from "./milestone-list.tsx";
import { useGameSession } from "./use-game-session.ts";

// What the frame may do. Scripts only: no same-origin access, so the game has no storage, cookies or session
// of the platform, no forms, no popups, no top navigation. The response headers for the game's files repeat
// this as a sandbox of their own, so it holds even if the files are opened outside this frame.
export const gameFrameSandbox = "allow-scripts";
export const gameFramePermissions = "fullscreen; autoplay; gamepad";

// Where the progress is, said only as far as it is true.
const blockedCopy: Record<SyncStatus, string> = {
  account:
    "This browser is blocking storage, so your progress is kept only on your account.",
  local:
    "This browser is blocking storage, so progress will be lost when you leave.",
  pending:
    "This browser is blocking storage and your account could not be reached, so progress will be lost when you leave.",
};

const keptCopy: Record<SyncStatus, string> = {
  account: "Your progress is saved to your account and kept in this browser.",
  local: "Your progress is kept in this browser only.",
  pending:
    "Your progress is kept in this browser. Saving it to your account is waiting for a connection.",
};

export function GamePlayer({
  accountFor,
  game,
  src,
  title,
}: {
  // How the page reaches the account for a game; the real one unless a test supplies another.
  readonly accountFor?: (gameId: string) => AccountPort;
  readonly game: HostedGame;
  readonly src: string;
  readonly title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { connected, kept, sync, unlocked } = useGameSession(
    game,
    frame,
    src,
    accountFor,
  );
  return (
    <>
      <ArcadePanel eyebrow="Playing here" title={title}>
        <StatusLamp
          label={connected ? "Connected to the platform" : "Connecting"}
          tone={connected ? "ready" : "attention"}
        />
        <iframe
          allow={gameFramePermissions}
          data-game-src={src}
          data-testid="game-frame"
          ref={frame}
          sandbox={gameFrameSandbox}
          style={{ border: 0, minHeight: "32rem", width: "100%" }}
          title={title}
        />
        <p>{kept ? keptCopy[sync] : blockedCopy[sync]}</p>
      </ArcadePanel>
      {game.milestones.length === 0 ? null : (
        <ArcadePanel eyebrow="Reported by the game" title="Your milestones">
          <MilestoneList milestones={game.milestones} unlocked={unlocked} />
          <p>
            The game reports these itself and the platform cannot check them
            yet, so nothing that carries value depends on them.
          </p>
        </ArcadePanel>
      )}
    </>
  );
}

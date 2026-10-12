"use client";

import type { HostedGame } from "@ador/game-sdk/host";
import type { GameMilestone } from "@ador/shared/games";
import type { AccountPort, SyncStatus } from "@ador/game-sdk/synced-backend";
import {
  ArcadeActionButton,
  ArcadeInfoCard,
  ArcadeInfoRow,
  ArcadeStage,
  StatusLamp,
} from "@repo/ui/arcade";
import { useRef, useState, type ReactNode } from "react";

import { MilestoneList } from "./milestone-list.tsx";
import { useFullscreen } from "./use-fullscreen.ts";
import { usePhoneLandscape } from "./use-phone-landscape.ts";
import { useGameSession } from "./use-game-session.ts";

// What the frame may do. Scripts only: no same-origin access, so the game has no storage, cookies or session
// of the platform, no forms, no popups, no top navigation. The response headers for the game's files repeat
// this as a sandbox of their own, so it holds even if the files are opened outside this frame.
export const gameFrameSandbox = "allow-scripts";
// Tall enough for a game built for a window, not a strip: most of the screen, and no more than a page.
export const gameFrameHeight = "min(85vh, 60rem)";
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
  children,
  game,
  src,
  title,
}: {
  // How the page reaches the account for a game; the real one unless a test supplies another.
  readonly accountFor?: (gameId: string) => AccountPort;
  // More small cards for the row under the stage.
  readonly children?: ReactNode;
  readonly game: HostedGame & { readonly milestones: readonly GameMilestone[] };
  readonly src: string;
  readonly title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { connected, kept, sync, toast, unlocked } = useGameSession(
    game,
    frame,
    src,
    accountFor,
  );
  const fullscreen = useFullscreen(frame);
  const phoneLandscape = usePhoneLandscape();
  const [promptDismissed, setPromptDismissed] = useState(false);
  const prompt = phoneLandscape && fullscreen.supported && !promptDismissed;
  return (
    <>
      <ArcadeStage
        bar={
          <>
            <StatusLamp
              label={connected ? "Connected to the platform" : "Connecting"}
              tone={connected ? "ready" : "attention"}
            />
            <span>{kept ? keptCopy[sync] : blockedCopy[sync]}</span>
            {fullscreen.supported ? (
              <span className="arcade-stage__bar-end">
                {fullscreen.refused ? (
                  <span role="status">
                    The browser did not allow full screen. Try again, or use the
                    browser&apos;s own full screen.
                  </span>
                ) : null}
                <span className="arcade-stage__hint">
                  Press Esc to leave full screen.
                </span>
                <ArcadeActionButton onClick={fullscreen.enter} tone="cyan">
                  Full screen
                </ArcadeActionButton>
              </span>
            ) : null}
          </>
        }
        overlay={
          <>
            <div
              aria-live="polite"
              className="arcade-toast"
              data-testid="milestone-toast"
              role="status"
            >
              {toast}
            </div>
            {prompt ? (
              <div className="arcade-prompt" data-testid="fullscreen-prompt">
                <p>
                  Playing on a phone? Full screen gives the game the whole
                  screen.
                </p>
                <ArcadeActionButton
                  onClick={() => {
                    setPromptDismissed(true);
                    fullscreen.enter();
                  }}
                  tone="cyan"
                >
                  Full screen
                </ArcadeActionButton>
                <ArcadeActionButton
                  onClick={() => setPromptDismissed(true)}
                  tone="pink"
                >
                  Not now
                </ArcadeActionButton>
              </div>
            ) : null}
          </>
        }
      >
        <iframe
          allow={gameFramePermissions}
          data-game-src={src}
          data-testid="game-frame"
          ref={frame}
          sandbox={gameFrameSandbox}
          style={{ border: 0, height: gameFrameHeight, minHeight: "32rem" }}
          title={title}
        />
      </ArcadeStage>
      <ArcadeInfoRow>
        {game.milestones.length === 0 ? null : (
          <ArcadeInfoCard title="Your milestones">
            <MilestoneList milestones={game.milestones} unlocked={unlocked} />
            <p>
              The game reports these itself and the platform cannot check them
              yet, so nothing that carries value depends on them.
            </p>
          </ArcadeInfoCard>
        )}
        {children}
      </ArcadeInfoRow>
    </>
  );
}

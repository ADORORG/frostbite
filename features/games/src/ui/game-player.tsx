"use client";

import type { HostedGame } from "@ador/game-sdk/host";
import type { WalletInfo } from "@ador/game-sdk/protocol";
import type { WalletNetwork } from "@ador/wallet/contracts";
import type { GameMilestone } from "@ador/shared/games";
import type { AccountPort, SyncStatus } from "@ador/game-sdk/synced-backend";
import {
  ArcadeActionButton,
  ArcadeDock,
  ArcadeInfoCard,
  ArcadeStage,
  StatusLamp,
  type DockSection,
} from "@repo/ui/arcade";
import { useRef, useState, type ReactNode } from "react";

import { MilestoneList } from "./milestone-list.tsx";
import { useFullscreen } from "./use-fullscreen.ts";
import { usePhoneLandscape } from "./use-phone-landscape.ts";
import { useGameSession } from "./use-game-session.ts";
import { WalletCard } from "./wallet-card.tsx";

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
  back,
  game,
  meta,
  sections = [],
  src,
  title,
  wallet,
}: {
  // How the page reaches the account for a game; the real one unless a test supplies another.
  readonly accountFor?: (gameId: string) => AccountPort;
  // A way back to the list, first in the bar.
  readonly back?: ReactNode;
  readonly game: HostedGame & { readonly milestones: readonly GameMilestone[] };
  // Small facts beside the title in the bar (version, network).
  readonly meta?: ReactNode;
  // More sections for the dock under the stage, after the player's milestones.
  readonly sections?: readonly DockSection[];
  readonly src: string;
  readonly title: string;
  // Set only for a game that declared the wallet capability: what the player has connected, how to ask for the
  // wallet chooser, and the network the game expects. Without it the game is never told about a wallet and the
  // dock has no wallet section.
  readonly wallet?: {
    readonly connect: () => void;
    readonly current: WalletInfo | null;
    readonly expectedNetwork: WalletNetwork;
  };
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { connected, kept, progress, sync, toast, unlocked } = useGameSession(
    game,
    frame,
    src,
    accountFor,
    { title, wallet: wallet?.current },
  );
  const fullscreen = useFullscreen(frame);
  const phoneLandscape = usePhoneLandscape();
  const [promptDismissed, setPromptDismissed] = useState(false);
  const prompt = phoneLandscape && fullscreen.supported && !promptDismissed;
  const dock: DockSection[] = [
    ...(game.milestones.length === 0
      ? []
      : [
          {
            badge:
              unlocked === null
                ? null
                : `${String(game.milestones.filter(({ id }) => unlocked[id] !== undefined).length)}/${String(game.milestones.length)}`,
            content: (
              <ArcadeInfoCard title="Your milestones">
                <MilestoneList
                  milestones={game.milestones}
                  progress={progress}
                  unlocked={unlocked}
                />
                <p>
                  The game reports these itself and the platform cannot check
                  them yet, so nothing that carries value depends on them.
                </p>
              </ArcadeInfoCard>
            ),
            id: "milestones",
            label: "Milestones",
          },
        ]),
    ...(wallet === undefined
      ? []
      : [
          {
            badge: wallet.current === null ? null : "Connected",
            content: (
              <WalletCard
                connect={wallet.connect}
                current={wallet.current}
                expectedNetwork={wallet.expectedNetwork}
              />
            ),
            id: "wallet",
            label: "Wallet",
          },
        ]),
    ...sections,
  ];
  return (
    <>
      <ArcadeStage
        bar={
          <>
            {back}
            <h2 className="arcade-stage__title">{title}</h2>
            {meta === undefined ? null : (
              <span className="arcade-stage__facts">{meta}</span>
            )}
            <StatusLamp
              label={connected ? "Connected to the platform" : "Connecting"}
              tone={connected ? "ready" : "attention"}
            />
            <span
              className="arcade-stage__save"
              title={kept ? keptCopy[sync] : blockedCopy[sync]}
            >
              {kept ? keptCopy[sync] : blockedCopy[sync]}
            </span>
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
          style={{ border: 0 }}
          title={title}
        />
      </ArcadeStage>
      <ArcadeDock label="About this game" sections={dock} />
    </>
  );
}

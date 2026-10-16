"use client";

import type {
  ClaimsService,
  HostedGame,
  RunsService,
} from "@ador/game-sdk/host";
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
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ClaimsApi } from "../client/claims-api.ts";
import { ClaimReview } from "./claim-review.tsx";
import { claimsDockSection } from "./claims-card.tsx";
import { MilestoneList } from "./milestone-list.tsx";
import type { ClaimSigner } from "./use-claims.ts";
import { usePlayerClaims } from "./use-player-claims.ts";
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

// What the player is told about how these milestones are known. A game that declared none replay-verifiable is told only
// that the game reports them; one that did is told the platform may check those, and that nothing is claimed until it has.
export function milestoneCopy(milestones: readonly GameMilestone[]): string {
  return milestones.some(
    ({ verification }) => verification === "replay-verified",
  )
    ? "Some of these can be replay-checked by the platform when you are signed in: it replays a run under the game's published rules. The rest the game reports itself and the platform cannot check. Nothing that carries value depends on any of them yet."
    : "The game reports these itself and the platform cannot check them yet, so nothing that carries value depends on them.";
}

export function GamePlayer({
  accountFor,
  back,
  claims,
  claimsFor,
  game,
  meta,
  runsFor,
  sections = [],
  src,
  title,
  wallet,
}: {
  // How the page reaches the account for a game; the real one unless a test supplies another.
  readonly accountFor?: (gameId: string) => AccountPort;
  // A way back to the list, first in the bar.
  readonly back?: ReactNode;
  // How the page asks the platform to start a claim, given a way to read the connected wallet; the real one unless a test
  // supplies another.
  readonly claimsFor?: (
    gameId: string,
    wallet: () => WalletInfo | null,
  ) => ClaimsService;
  // Present for a game whose milestones can be claimed on chain: how the page reaches the claim routes, the wallet the player
  // has connected (the page's own use of it: the game is not told), and how that wallet signs a claim, if it can.
  readonly claims?: {
    readonly api?: ClaimsApi;
    readonly pollMs?: number;
    readonly sign?: ClaimSigner;
    readonly wallet: WalletInfo | null;
  };
  readonly game: HostedGame & { readonly milestones: readonly GameMilestone[] };
  // Small facts beside the title in the bar (version, network).
  readonly meta?: ReactNode;
  // How the page reaches the platform to start and settle runs; the real one unless a test supplies another.
  readonly runsFor?: (gameId: string) => RunsService;
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
  const {
    claimsFor: claimsOf,
    bindTelling,
    titles,
    ui: claimUi,
  } = usePlayerClaims(game.milestones, game.id, claims, claimsFor);
  const { connected, emitClaim, kept, progress, sync, toast, unlocked } =
    useGameSession(
      game,
      frame,
      src,
      accountFor,
      { connectWallet: wallet?.connect, title, wallet: wallet?.current },
      runsFor,
      claimsOf,
    );
  useEffect(() => {
    bindTelling(emitClaim);
  }, [bindTelling, emitClaim]);
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
                  claim={
                    claims === undefined
                      ? undefined
                      : {
                          message: claimUi.message,
                          start: (id) => void claimUi.start(id),
                          stateOf: claimUi.stateOf,
                        }
                  }
                  milestones={game.milestones}
                  progress={progress}
                  unlocked={unlocked}
                />
                <p>{milestoneCopy(game.milestones)}</p>
              </ArcadeInfoCard>
            ),
            id: "milestones",
            label: "Milestones",
          },
        ]),
    ...(claims === undefined
      ? []
      : [claimsDockSection(claimUi.claims, claimUi.reopen, titles)]),
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
            {claimUi.active === null ? null : (
              <ClaimReview
                canSign={claimUi.canSign}
                claim={claimUi.active}
                message={claimUi.message}
                onClose={claimUi.dismiss}
                onSign={() => void claimUi.sign()}
                title={
                  titles[claimUi.active.milestoneId] ??
                  claimUi.active.milestoneId
                }
                working={claimUi.working}
              />
            )}
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

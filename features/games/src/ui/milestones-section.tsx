import type { GameMilestone } from "@frostbite/shared/games";
import type { ShareConfig } from "@frostbite/share";
import { ArcadeInfoCard, type DockSection } from "@repo/ui/arcade";

import type { SharesApi } from "../client/shares-api.ts";
import type { ClaimFeeSettings } from "../wallet-config.ts";
import { ClaimFeesBeside } from "./claim-fees.tsx";
import { MilestoneList } from "./milestone-list.tsx";
import { MilestoneShare } from "./score-share.tsx";
import type { usePlayerClaims } from "./use-player-claims.ts";
import type { MilestoneProgress } from "./use-game-session.ts";

// What the player is told about how these milestones are known. A game that declared none replay-verifiable is told only
// that the game reports them; one that did is told the platform may check those, and that nothing is claimed until it has.
export function milestoneCopy(milestones: readonly GameMilestone[]): string {
  return milestones.some(
    ({ verification }) => verification === "replay-verified",
  )
    ? "Some of these can be replay-checked by the platform when you are signed in: it replays a run under the game's published rules. The rest the game reports itself and the platform cannot check. Nothing that carries value depends on any of them yet."
    : "The game reports these itself and the platform cannot check them yet, so nothing that carries value depends on them.";
}

// The "Your milestones" section of a game's dock: each milestone's card, how many are reached, and how they are known. A milestone the player
// holds has a Share chip when sharing is on for them.
export function milestonesSection({
  claimUi,
  claims,
  game,
  progress,
  share,
  title,
  unlocked,
}: {
  readonly claimUi: ReturnType<typeof usePlayerClaims>["ui"];
  readonly claims?: { readonly fees?: ClaimFeeSettings } | undefined;
  readonly game: {
    readonly id: string;
    readonly milestones: readonly GameMilestone[];
  };
  readonly progress: MilestoneProgress;
  // Present when the player may share: where a link can go, and how it is made.
  readonly share:
    | {
        readonly api?: SharesApi | undefined;
        readonly config: ShareConfig | undefined;
      }
    | undefined;
  readonly title: string;
  readonly unlocked: Readonly<Record<string, string>> | null;
}): DockSection {
  return {
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
                  latestOf: claimUi.latestOf,
                  review: claimUi.reopen,
                  start: (id) => void claimUi.start(id),
                }
          }
          milestones={game.milestones}
          progress={progress}
          {...(share?.config === undefined
            ? {}
            : {
                shareOf: ({ id, title: milestoneTitle }: GameMilestone) => (
                  <MilestoneShare
                    api={share.api}
                    config={share.config as ShareConfig}
                    gameId={game.id}
                    gameTitle={title}
                    milestoneId={id}
                    title={milestoneTitle}
                  />
                ),
              })}
          unlocked={unlocked}
        />
        <ClaimFeesBeside fees={claims?.fees} ui={claimUi} />
        <p>{milestoneCopy(game.milestones)}</p>
      </ArcadeInfoCard>
    ),
    id: "milestones",
    label: "Milestones",
  };
}

import type { GameClaim, GameMilestone } from "@frostbite/shared/games";
import { ArcadeActionButton, ArcadeStatusCard } from "@repo/ui/arcade";

import { gameMilestonePolicyLabels } from "../domain/catalog.ts";
import {
  canStartClaim,
  claimCopy,
  claimTone,
  showsDelayed,
} from "../domain/claim-copy.ts";
import type { MilestoneView } from "../domain/milestone-state.ts";

// What a milestone the game declared replay-verifiable says before it is checked. It promises nothing: the platform can
// replay a run only for a player who is signed in, and only if it holds the game's rules.
export const replayCheckable =
  "The platform can replay a run to check this one when you are signed in; otherwise it is reported by the game.";

// How a player starts, or looks again at, the claim of a milestone.
export interface MilestoneClaiming {
  readonly latestOf: (milestoneId: string) => GameClaim | null;
  readonly review: (claimId: string) => void;
  readonly start: (milestoneId: string) => void;
}

// One milestone: its name and where it stands, how it is earned, and the one thing to do about it. What it takes to earn it and
// how it is known are said quietly under the name; how it is known (and what the platform can and cannot check) is behind a fold.
// An earned milestone has a Claim button where a claim can be started, and where one is under way or over, its state and a way to
// look at it again, so there is never more than one thing to press.
export function MilestoneCard({
  claiming,
  milestone,
  view,
}: {
  readonly claiming?: MilestoneClaiming | undefined;
  readonly milestone: GameMilestone;
  // Absent while the player's records are not known (the game cannot be played here).
  readonly view?: MilestoneView | undefined;
}) {
  const latest =
    claiming === undefined || view?.state !== "earned"
      ? null
      : claiming.latestOf(milestone.id);
  const claim =
    claiming === undefined || view?.state !== "earned" ? undefined : claiming;
  const status =
    view === undefined
      ? undefined
      : latest === null
        ? {
            label: view.label,
            tone:
              view.state === "earned" ? ("done" as const) : ("idle" as const),
          }
        : { label: claimCopy(latest).label, tone: claimTone(latest.state) };
  const checked = view?.assurance === "replay-checked";
  // What is known about how it is known: the detail only for what was reached (a card not reached stays short), and what the
  // platform can check only for a milestone the game declared replay-verifiable and that has not been checked yet.
  const notes = [
    view?.state === "earned" ? view.detail : null,
    milestone.verification === "replay-verified" && !checked
      ? replayCheckable
      : null,
  ].filter((note) => note !== null);
  return (
    <div
      data-claim-state={latest?.state}
      data-delayed={
        latest !== null && showsDelayed(latest) ? "true" : undefined
      }
    >
      <ArcadeStatusCard
        action={
          claim === undefined ? undefined : canStartClaim(latest) ? (
            <ArcadeActionButton
              onClick={() => claim.start(milestone.id)}
              tone="mint"
            >
              {`Claim ${milestone.title}`}
            </ArcadeActionButton>
          ) : (
            <ArcadeActionButton
              onClick={() => latest !== null && claim.review(latest.id)}
              tone="cyan"
            >
              View claim
            </ArcadeActionButton>
          )
        }
        status={status}
        title={milestone.title}
      >
        <p>{`How it is earned: ${milestone.criteria}`}</p>
        <p>
          {gameMilestonePolicyLabels[milestone.claimPolicy]}
          {checked ? (
            <>
              {" "}
              · <span>Replay-checked</span>
            </>
          ) : null}
        </p>
        {notes.length === 0 ? null : (
          <details>
            <summary>How this is known</summary>
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </details>
        )}
      </ArcadeStatusCard>
    </div>
  );
}

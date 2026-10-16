import type { GameClaimState, GameMilestone } from "@ador/shared/games";
import { ArcadeActionButton, ArcadeBadge } from "@repo/ui/arcade";

import { gameMilestonePolicyLabels } from "../domain/catalog.ts";
import { claimStateCopy } from "../domain/claim-copy.ts";
import { presentMilestone, reachedSummary } from "../domain/milestone-state.ts";
import type { MilestoneProgress } from "./use-game-session.ts";

// What a milestone the game declared replay-verifiable says before it is checked. It promises nothing: the platform can
// replay a run only for a player who is signed in, and only if it holds the game's rules.
export const replayCheckable =
  "The platform can replay a run to check this one when you are signed in; otherwise it is reported by the game.";

// A game's milestones. With the player's records (`unlocked`), each is in the state the platform's records say and
// a polite live region tells a screen reader when the game reports a new one; with none (`null`: the game cannot
// be played here), they are only what the game declares. Either way each says how it is earned.
export function MilestoneList({
  claim,
  milestones,
  progress,
  unlocked,
}: {
  // Present for a game whose milestones can be claimed: how each claim stands, and how to start one.
  readonly claim?: {
    readonly message: string | null;
    readonly start: (milestoneId: string) => void;
    readonly stateOf: (milestoneId: string) => GameClaimState | null;
  };
  readonly milestones: readonly GameMilestone[];
  // How often each was earned and the total toward each target, when the player's records say.
  readonly progress?: MilestoneProgress;
  readonly unlocked: Readonly<Record<string, string>> | null;
}) {
  const views =
    unlocked === null
      ? null
      : milestones.map((milestone) =>
          presentMilestone(milestone, unlocked[milestone.id], {
            count: progress?.counts[milestone.id],
            total: progress?.totals[milestone.id],
            verification: progress?.levels[milestone.id],
          }),
        );
  return (
    <>
      {views === null ? null : (
        <p aria-live="polite" data-testid="milestone-summary" role="status">
          {reachedSummary(views)}
        </p>
      )}
      {claim?.message == null ? null : <p role="alert">{claim.message}</p>}
      <ul aria-label="Milestones of this game">
        {milestones.map((milestone, index) => {
          const view = views?.[index];
          return (
            <li
              data-milestone={milestone.id}
              data-state={view?.state}
              key={milestone.id}
            >
              <strong>{milestone.title}</strong>
              {view === undefined ? null : (
                <>
                  {" "}
                  — <span>{view.label}</span>
                </>
              )}{" "}
              <ArcadeBadge tone="yellow">
                {gameMilestonePolicyLabels[milestone.claimPolicy]}
              </ArcadeBadge>
              {view?.assurance === "replay-checked" ? (
                <>
                  {" "}
                  <ArcadeBadge tone="mint">Replay-checked</ArcadeBadge>
                </>
              ) : null}
              <br />
              <small>{`How it is earned: ${milestone.criteria}`}</small>
              {milestone.verification === "replay-verified" &&
              view?.assurance !== "replay-checked" ? (
                <>
                  <br />
                  <small>{replayCheckable}</small>
                </>
              ) : null}
              {view?.state === "earned" ? (
                <>
                  <br />
                  <small>{view.detail}</small>
                </>
              ) : null}
              {claim !== undefined && view?.state === "earned" ? (
                <>
                  <br />
                  {(() => {
                    const state = claim.stateOf(milestone.id);
                    return state === null ||
                      state === "failed" ||
                      state === "expired" ? (
                      <ArcadeActionButton
                        onClick={() => claim.start(milestone.id)}
                        tone="mint"
                      >
                        {`Claim ${milestone.title}`}
                      </ArcadeActionButton>
                    ) : (
                      <small data-claim-state={state}>
                        {`Claim: ${claimStateCopy[state].label}`}
                      </small>
                    );
                  })()}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

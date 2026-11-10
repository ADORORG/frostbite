import type { MilestoneLevel } from "@frostbite/game-saves";
import type { GameManifest } from "@frostbite/shared/games";

// The level a player's account must hold a milestone at before it can be claimed on the chain, from the milestone's own manifest. A
// milestone the manifest says only a replay can prove (`replay-verified`) is claimable on a verified level alone: the account holds a
// milestone as self-reported whenever the game's page says so, and that page is the player's own browser. Every other milestone is
// claimable at either level, as ADR-018 Amendment 2 allows.
export function claimableAt(
  milestone: Pick<GameManifest["milestones"][number], "verification">,
  held: MilestoneLevel | null,
): boolean {
  if (held === null) return false;
  return (
    milestone.verification !== "replay-verified" || held === "replay-verified"
  );
}

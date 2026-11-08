import type { MilestoneRules } from "@frostbite/game-saves";
import type { GameManifest } from "@frostbite/shared/games";

// Each listed game with the milestones it declares and what each allows: what the sync and share services check a request against.
export function milestoneRulesOf(
  games: readonly GameManifest[],
): ReadonlyMap<string, MilestoneRules> {
  return new Map(
    games.map(({ id, milestones }) => [
      id,
      new Map(
        milestones.map(({ claimPolicy, id: milestoneId, maxCount, target }) => [
          milestoneId,
          { claimPolicy, maxCount, target },
        ]),
      ),
    ]),
  );
}

import type { GameClient } from "@ador/game-sdk/client";

// The game's own progression marks are camelCase (`firstWin`); a milestone's id on the platform is a slug
// (`first-win`).
export function milestoneIdOf(mark: string): string {
  return mark.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

// Tells the platform when the game marks a milestone, if the platform's manifest for the game declares it. The
// game calls this for every mark it makes; a mark the manifest does not declare is simply not reported, so which
// of the game's marks count is the manifest's decision and not the game's. A failed call is dropped: the game
// plays on and the mark is tried again the next time the game makes it.
export async function createMilestoneBridge(
  client: Pick<GameClient, "milestones">,
) {
  const declared = new Set(
    (await client.milestones.list().catch(() => [])).map(({ id }) => id),
  );
  const reported = new Set<string>();
  return {
    report: (mark: string): void => {
      const id = milestoneIdOf(mark);
      if (!declared.has(id) || reported.has(id)) return;
      reported.add(id);
      void client.milestones.unlock(id).catch(() => reported.delete(id));
    },
  };
}

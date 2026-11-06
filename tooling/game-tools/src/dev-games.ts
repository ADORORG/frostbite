import type { DevGame } from "@frostbite/game-sdk/dev-host";

// What the local test page needs of a registered game, taken from its manifest: who it is, what it asks for, and its milestones.
// A manifest that is not in the list is refused with the ids that are, so a typo is seen at once.
export function devGameOf(
  games: readonly {
    readonly capabilities: readonly string[];
    readonly id: string;
    readonly milestones: readonly {
      readonly claimPolicy: "once" | "repeatable";
      readonly criteria: string;
      readonly description: string;
      readonly id: string;
      readonly maxCount?: number | undefined;
      readonly target?: number | undefined;
      readonly title: string;
    }[];
  }[],
  id: string,
): DevGame {
  const game = games.find((candidate) => candidate.id === id);
  if (game === undefined)
    throw new Error(
      `No game "${id}" is registered. Registered: ${games.map((registered) => registered.id).join(", ") || "none"}.`,
    );
  return {
    capabilities: [...game.capabilities],
    id: game.id,
    milestones: game.milestones.map(
      ({
        claimPolicy,
        criteria,
        description,
        id: milestone,
        maxCount,
        target,
        title,
      }) => ({
        claimPolicy,
        criteria,
        description,
        id: milestone,
        ...(maxCount === undefined ? {} : { maxCount }),
        ...(target === undefined ? {} : { target }),
        title,
      }),
    ),
  };
}

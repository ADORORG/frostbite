import { z } from "zod";

// The contract a game's milestones are claimed from, named by the template it is deployed from and that template's version
// (the same two fields a `deploy` intent carries, so a registration can deploy it as declared). Which templates exist is the
// platform's own list, checked where a game is registered; the manifest says only which one the game wants.
// Declaring this does not mint anything: it says that the game's milestones can be claimed on chain by the player who earned
// them, within the claim limit each milestone's own policy gives (`milestoneClaimLimit`).
export const gameRewardsSchema = z
  .object({
    templateId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u),
    templateVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
  })
  .strict();

export type GameRewards = z.infer<typeof gameRewardsSchema>;

// The most times one address may claim a milestone, which the rewards contract enforces on chain: a milestone earned once is
// claimed once; a repeatable one up to the count the manifest allows. It is the manifest's policy and nothing else that sets it.
export function milestoneClaimLimit(milestone: {
  readonly claimPolicy: "once" | "repeatable";
  readonly maxCount?: number | undefined;
}): number {
  if (milestone.claimPolicy === "once") return 1;
  if (milestone.maxCount === undefined)
    throw new RangeError("A repeatable milestone has no maximum count.");
  return milestone.maxCount;
}

export interface RewardsInitialisation extends GameRewards {
  // Every milestone the game declares is enabled in the contract, with its claim limit.
  readonly milestones: readonly {
    readonly claimLimit: number;
    readonly id: string;
  }[];
}

// What the game's rewards contract is initialised with, taken from the manifest alone; null when the game declares none.
export function rewardsInitialisation(game: {
  readonly milestones: readonly {
    readonly claimPolicy: "once" | "repeatable";
    readonly id: string;
    readonly maxCount?: number | undefined;
  }[];
  readonly rewards?: GameRewards | undefined;
}): RewardsInitialisation | null {
  if (game.rewards === undefined) return null;
  return {
    ...game.rewards,
    milestones: game.milestones.map((milestone) => ({
      claimLimit: milestoneClaimLimit(milestone),
      id: milestone.id,
    })),
  };
}

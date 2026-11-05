import { chainRefSchema } from "@frostbite/shared/chain";
import { describe, expect, it } from "vitest";

import { betaChain } from "@repo/configs/chains";
import { rewardsPlan } from "@repo/configs/rewards-plan";
import { rewardsPolicy } from "@repo/configs/rewards-policy";

describe("the rewards plan staff administration follows", () => {
  it("is the beta's chain, with the family the chain is configured with", () => {
    expect(rewardsPlan.chain).toBe(
      chainRefSchema.parse(betaChain.chain.chainId),
    );
    expect(rewardsPlan.family).toBe("bitcoin-alkanes");
  });

  it("makes a game from the game template and its collectibles from the collectible template, both publishable", () => {
    expect(rewardsPlan.gameTemplate).toEqual({
      id: "game-rewards",
      version: "1.0.0",
    });
    expect(rewardsPlan.collectibleTemplate).toEqual({
      id: "milestone-collectible",
      version: "1.0.0",
    });
    expect(rewardsPlan.publishable).toEqual([
      rewardsPlan.gameTemplate,
      rewardsPlan.collectibleTemplate,
    ]);
  });

  it("publishes exactly the templates the policy lists, and allows a contract the size the policy states", () => {
    expect(rewardsPlan.publishable.map(({ id }: { id: string }) => id)).toEqual(
      rewardsPolicy.templates.map(({ crate }) => crate),
    );
    expect(rewardsPlan.maxDrawingBytes).toBe(rewardsPolicy.maxDrawingBytes);
  });
});

import { verificationLevels } from "@frostbite/game-sdk/protocol";
import { gameMilestoneVerifications } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

// The SDK is published on its own and cannot import the platform's contracts, so the two lists of how a milestone can be
// known are written twice. This is the one place they are held equal.
describe("the verification levels a game and the platform name", () => {
  it("are the same list, in the same order", () => {
    expect([...verificationLevels]).toEqual([...gameMilestoneVerifications]);
  });
});

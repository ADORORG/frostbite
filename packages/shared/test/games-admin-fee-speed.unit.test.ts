import { describe, expect, it } from "vitest";

import { startGameAdminStepInputSchema } from "../src/games/admin.ts";

describe("choosing a fee speed for a step", () => {
  const start = {
    action: {
      operation: "publish-template",
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    },
    gameId: null,
    wallet: "tb1qwallet",
  };

  it("is optional, and one of the four speeds when given", () => {
    expect(startGameAdminStepInputSchema.parse(start)).toBeDefined();
    for (const feeSpeed of ["slow", "medium", "fast", "lightning"]) {
      expect(
        startGameAdminStepInputSchema.parse({ ...start, feeSpeed }).feeSpeed,
      ).toBe(feeSpeed);
    }
    for (const feeSpeed of ["turbo", "", 3, null]) {
      expect(() =>
        startGameAdminStepInputSchema.parse({ ...start, feeSpeed }),
      ).toThrow();
    }
  });
});

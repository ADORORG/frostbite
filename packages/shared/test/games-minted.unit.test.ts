import { describe, expect, it } from "vitest";

import {
  listMintedMilestonesInputSchema,
  listMintedMilestonesResponseSchema,
  mintedMilestoneSchema,
} from "../src/games/index.ts";

const mint = {
  claimId: "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60",
  gameId: "arcade",
  milestoneId: "first-win",
  mintedAt: "2026-10-17T12:00:00.000Z",
  transactionId: "ab".repeat(32),
};

describe("a minted milestone on the wire", () => {
  it("accepts a mint, and the list of them", () => {
    expect(mintedMilestoneSchema.parse(mint)).toEqual(mint);
    expect(
      listMintedMilestonesResponseSchema.parse({ minted: [mint] }).minted,
    ).toHaveLength(1);
  });

  it.each([
    ["an unknown field", { ...mint, wallet: "bc1q" }],
    ["no transaction", { ...mint, transactionId: "" }],
    ["a claim that is not an identifier", { ...mint, claimId: "x" }],
    ["a time that is not a time", { ...mint, mintedAt: "yesterday" }],
  ])("refuses %s", (_name, value) => {
    expect(mintedMilestoneSchema.safeParse(value).success).toBe(false);
  });

  it("asks for nothing, so a request that names a player is refused", () => {
    expect(listMintedMilestonesInputSchema.safeParse({}).success).toBe(true);
    expect(
      listMintedMilestonesInputSchema.safeParse({ userId: "someone" }).success,
    ).toBe(false);
  });
});

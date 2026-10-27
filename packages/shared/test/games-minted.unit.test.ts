import { describe, expect, it } from "vitest";

import {
  getMintedPictureInputSchema,
  getMintedPictureResponseSchema,
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

describe("the picture of a minted milestone on the wire", () => {
  const ok = {
    contentType: "image/svg+xml",
    data: "PHN2Zz48L3N2Zz4=",
    edition: 1,
    status: "ok",
  };

  it("accepts a picture, and a reason for having none", () => {
    expect(getMintedPictureResponseSchema.safeParse(ok).success).toBe(true);
    expect(
      getMintedPictureResponseSchema.safeParse({
        reason: "no-picture",
        status: "unavailable",
      }).success,
    ).toBe(true);
  });

  it.each([
    [
      "a kind of picture that is not shown",
      { ...ok, contentType: "text/html" },
    ],
    ["no bytes", { ...ok, data: "" }],
    ["an edition of nothing", { ...ok, edition: 0 }],
    ["an unknown reason", { reason: "gone", status: "unavailable" }],
  ])("refuses %s", (_name, value) => {
    expect(getMintedPictureResponseSchema.safeParse(value).success).toBe(false);
  });

  it("asks about a claim by its identifier only", () => {
    expect(
      getMintedPictureInputSchema.safeParse({ claimId: mint.claimId }).success,
    ).toBe(true);
    expect(
      getMintedPictureInputSchema.safeParse({ claimId: "x" }).success,
    ).toBe(false);
  });
});

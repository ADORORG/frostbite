import { describe, expect, it } from "vitest";

import {
  getMintedPictureInputSchema,
  getMintedPictureFileSchema,
  mintedPictureHref,
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

describe("the picture of a minted milestone", () => {
  const file = {
    bytes: new Uint8Array([60, 115]),
    contentType: "image/svg+xml",
  };

  it("is a file of a kind that is shown", () => {
    expect(getMintedPictureFileSchema.safeParse(file).success).toBe(true);
  });

  it.each([
    [
      "a kind of picture that is not shown",
      { ...file, contentType: "text/html" },
    ],
    ["text for bytes", { ...file, bytes: "PHN2Zz4=" }],
    ["anything more", { ...file, edition: 1 }],
  ])("refuses %s", (_name, value) => {
    expect(getMintedPictureFileSchema.safeParse(value).success).toBe(false);
  });

  it("is read at an address that names the claim and nothing else, encoded", () => {
    expect(mintedPictureHref(mint.claimId)).toBe(
      `/api/v1/games/milestones/picture?claimId=${mint.claimId}`,
    );
    expect(mintedPictureHref("a&b=c d")).toBe(
      "/api/v1/games/milestones/picture?claimId=a%26b%3Dc+d",
    );
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

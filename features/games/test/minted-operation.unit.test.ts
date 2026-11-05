import type {
  GameClaimsService,
  MintedClaim,
  MintedPictureResult,
} from "@frostbite/game-claims";
import {
  getMintedPictureFileSchema,
  getMintedPictureRoute,
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
} from "@frostbite/shared/games";
import { describe, expect, it, vi } from "vitest";

import {
  createGetMintedPictureOperation,
  createListMintedMilestonesOperation,
} from "../src/application/minted-operation.ts";
import { anonymous, context, userId } from "./support/claim-views.ts";

const mint: MintedClaim = {
  claimId: "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a",
  gameId: "arcade",
  milestoneId: "first-win",
  mintedAt: "2026-10-17T12:00:00.000Z",
  transactionId: "ab".repeat(32),
};
const operationOver = (minted: GameClaimsService["minted"]) =>
  createListMintedMilestonesOperation(async () => ({ minted }));

describe("the list of what a player minted", () => {
  it("is an authenticated, keyless POST on its contract route", () => {
    const operation = operationOver(async () => []);
    expect(operation).toMatchObject({
      access: { kind: "authenticated" },
      idempotency: "none",
      ...listMintedMilestonesRoute,
    });
  });

  it("asks for the session's player, whatever else the request says", async () => {
    const minted = vi.fn(async () => [mint]);
    const answer = await operationOver(minted).execute({}, context);
    expect(minted).toHaveBeenCalledExactlyOnceWith(userId);
    expect(answer).toEqual({ ok: true, value: { minted: [mint] } });
    expect(
      listMintedMilestonesResponseSchema.safeParse(
        answer.ok ? answer.value : null,
      ).success,
    ).toBe(true);
  });

  it("is refused, without asking the service, when nobody is signed in", async () => {
    const minted = vi.fn(async () => [mint]);
    const answer = await operationOver(minted).execute({}, anonymous);
    expect(answer.ok).toBe(false);
    expect(minted).not.toHaveBeenCalled();
  });
});

describe("the picture of a minted milestone", () => {
  const ask = { claimId: mint.claimId };
  const operationFor = (picture: GameClaimsService["picture"]) =>
    createGetMintedPictureOperation(async () => ({ picture }));

  it("is an authenticated GET of a file on its contract route, kept by the browser for a day", () => {
    const operation = operationFor(async () => ({
      code: "not-found",
      ok: false,
    }));
    expect(operation).toMatchObject({
      access: { kind: "authenticated" },
      cache: { kind: "max-age", seconds: 86_400 },
      files: ["image/svg+xml"],
      idempotency: "none",
      input: "query",
      ...getMintedPictureRoute,
    });
    expect(getMintedPictureRoute.method).toBe("GET");
  });

  it("is the bytes and their kind, for the session's player and the claim asked about", async () => {
    const bytes = new TextEncoder().encode("<svg></svg>");
    const picture = vi.fn(async (): Promise<MintedPictureResult> => ({
      bytes,
      contentType: "image/svg+xml",
      edition: 4,
      ok: true,
    }));
    const answer = await operationFor(picture).execute(ask, context);
    expect(picture).toHaveBeenCalledExactlyOnceWith(userId, mint.claimId);
    expect(answer).toEqual({
      ok: true,
      value: { bytes, contentType: "image/svg+xml" },
    });
    expect(
      getMintedPictureFileSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
  });

  it.each(["chain-unavailable", "no-picture", "not-found"] as const)(
    "is a not-found that says why (%s) when there is no picture to show",
    async (code) => {
      const answer = await operationFor(async () => ({
        code,
        ok: false,
      })).execute(ask, context);
      expect(answer).toMatchObject({
        error: "not_found",
        ok: false,
        reason: code,
      });
    },
  );

  it("is refused, without asking the service, when nobody is signed in", async () => {
    const picture = vi.fn(async (): Promise<MintedPictureResult> => ({
      code: "not-found",
      ok: false,
    }));
    expect((await operationFor(picture).execute(ask, anonymous)).ok).toBe(
      false,
    );
    expect(picture).not.toHaveBeenCalled();
  });
});

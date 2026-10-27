import type {
  GameClaimsService,
  MintedClaim,
  MintedPictureResult,
} from "@ador/game-claims";
import {
  getMintedPictureResponseSchema,
  getMintedPictureRoute,
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
} from "@ador/shared/games";
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

  it("is an authenticated, keyless POST on its contract route", () => {
    expect(
      operationFor(async () => ({ code: "not-found", ok: false })),
    ).toMatchObject({
      access: { kind: "authenticated" },
      idempotency: "none",
      ...getMintedPictureRoute,
    });
  });

  it("is sent as base64 text with its kind and edition, for the session's player and the claim asked about", async () => {
    const picture = vi.fn(async (): Promise<MintedPictureResult> => ({
      bytes: new TextEncoder().encode("<svg></svg>"),
      contentType: "image/svg+xml",
      edition: 4,
      ok: true,
    }));
    const answer = await operationFor(picture).execute(ask, context);
    expect(picture).toHaveBeenCalledExactlyOnceWith(userId, mint.claimId);
    expect(answer).toEqual({
      ok: true,
      value: {
        contentType: "image/svg+xml",
        data: "PHN2Zz48L3N2Zz4=",
        edition: 4,
        status: "ok",
      },
    });
    expect(
      getMintedPictureResponseSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
  });

  it("is an answer with its reason when there is no picture to show", async () => {
    const answer = await operationFor(async () => ({
      code: "no-picture",
      ok: false,
    })).execute(ask, context);
    expect(answer).toEqual({
      ok: true,
      value: { reason: "no-picture", status: "unavailable" },
    });
  });

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

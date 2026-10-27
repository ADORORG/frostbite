import type { GameClaimsService, MintedClaim } from "@ador/game-claims";
import {
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
} from "@ador/shared/games";
import { describe, expect, it, vi } from "vitest";

import { createListMintedMilestonesOperation } from "../src/application/minted-operation.ts";
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

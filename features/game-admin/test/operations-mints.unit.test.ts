import { chainRefSchema } from "@frostbite/shared/chain";
import {
  gameAdminCapability,
  gameAdminMintRoutes,
  gameMintsPageSize,
  listGameMintsInputSchema,
  setPlatformFeeInputSchema,
} from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { chain, gameId, staffId } from "./support/fixtures.ts";
import { anonymous, context } from "./support/operations-stub.ts";
import { at, claimId, mintsStub, treasury } from "./support/mints-stub.ts";

const cursor = `${at.toISOString()}~${claimId}`;

describe("the operations for mints and the platform fee", () => {
  it("need the administration capability, state no caching on the reads (and only the reads), and sit on their contract routes", () => {
    const s = mintsStub();
    for (const [operation, route, input] of [
      [s.list, gameAdminMintRoutes.mints, "query"],
      [s.totals, gameAdminMintRoutes.mintTotals, "none"],
      [s.platformFee, gameAdminMintRoutes.platformFee, "none"],
    ] as const)
      expect(operation).toMatchObject({
        access: { capability: gameAdminCapability, kind: "platform" },
        cache: { kind: "no-store" },
        idempotency: "none",
        input,
        ...route,
      });
    expect(s.set).toMatchObject({
      access: { capability: gameAdminCapability, kind: "platform" },
      idempotency: "none",
      input: "json",
      ...gameAdminMintRoutes.setPlatformFee,
    });
    expect(s.set).not.toHaveProperty("cache");
  });

  it("turn away a caller who is not signed in, whatever they ask", async () => {
    const s = mintsStub();
    for (const result of [
      await s.list.execute({ gameId }, anonymous),
      await s.totals.execute({}, anonymous),
      await s.platformFee.execute({}, anonymous),
      await s.set.execute({ chain, feeUnits: "1500", treasury }, anonymous),
    ])
      expect(result).toMatchObject({ ok: false });
    expect(s.mints.totalsFor).not.toHaveBeenCalled();
    expect(s.fees.change).not.toHaveBeenCalled();
  });
});

describe("a game's mints", () => {
  it("are its totals and a page of its newest completed ones, amounts as text, and where the next page starts", async () => {
    const s = mintsStub();
    const result = await s.list.execute({ gameId }, context);
    expect(s.mints.totalsFor).toHaveBeenCalledWith([gameId]);
    expect(s.mints.recent).toHaveBeenCalledWith(
      gameId,
      gameMintsPageSize,
      undefined,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        mints: [
          {
            claimId,
            completedAt: at.toISOString(),
            milestoneId: "first-win",
            platformFeeUnits: "1500",
            transactionId: "ab".repeat(16),
            wallet: "sim:one:a1b2c3fe",
          },
        ],
        next: cursor,
        totals: { completed: 3, feesAccruedUnits: "4500", inProgress: 1 },
      },
    });
  });

  it("start the next page where the cursor says, and the cursor must be one a page gave", async () => {
    const s = mintsStub();
    await s.list.execute({ after: cursor, gameId }, context);
    expect(s.mints.recent).toHaveBeenCalledWith(gameId, gameMintsPageSize, {
      claimId,
      completedAt: at,
    });
    for (const bad of [
      "",
      "yesterday",
      `${at.toISOString()}~not-an-id`,
      `${at.toISOString()}~${claimId}~x`,
    ])
      expect(
        listGameMintsInputSchema.safeParse({ after: bad, gameId }).success,
      ).toBe(false);
    expect(
      listGameMintsInputSchema.safeParse({ after: cursor, gameId }).success,
    ).toBe(true);
  });

  it("are none, and nothing is read, for a game the platform does not administer", async () => {
    const s = mintsStub();
    const result = await s.list.execute({ gameId: "plain" }, context);
    expect(result).toEqual({
      ok: true,
      value: {
        mints: [],
        next: null,
        totals: { completed: 0, feesAccruedUnits: "0", inProgress: 0 },
      },
    });
    expect(s.mints.totalsFor).not.toHaveBeenCalled();
    expect(s.mints.recent).not.toHaveBeenCalled();
  });

  it("end with no next cursor on the last page", async () => {
    const s = mintsStub({ recent: async () => ({ mints: [], next: null }) });
    expect(await s.list.execute({ gameId }, context)).toMatchObject({
      ok: true,
      value: { mints: [], next: null },
    });
  });
});

describe("a game's totals", () => {
  it("are zero when the report gives none for the game, rather than missing", async () => {
    const s = mintsStub({ totalsFor: async () => [] });
    expect(await s.list.execute({ gameId }, context)).toMatchObject({
      value: {
        totals: { completed: 0, feesAccruedUnits: "0", inProgress: 0 },
      },
    });
  });
});

describe("the totals of every game", () => {
  it("are asked for the games that declare rewards only, one row each", async () => {
    const s = mintsStub();
    const result = await s.totals.execute({}, context);
    expect(s.mints.totalsFor).toHaveBeenCalledWith([gameId]);
    expect(result).toEqual({
      ok: true,
      value: {
        games: [
          {
            completed: 3,
            feesAccruedUnits: "4500",
            gameId,
            inProgress: 1,
          },
        ],
      },
    });
  });
});

describe("the platform fee, as staff see it", () => {
  it("is no current setting, and no history, before the first one", async () => {
    const s = mintsStub({
      view: async () => ({
        current: null,
        history: [],
        maximumFeeSats: 100_000n,
      }),
    });
    expect(await s.platformFee.execute({}, context)).toMatchObject({
      value: { chains: [{ chain, current: null, history: [] }] },
    });
  });

  it("is the fee in force and the settings before it, each with the name of who set it (none when that account is gone)", async () => {
    const s = mintsStub();
    const result = await s.platformFee.execute({}, context);
    expect(s.fees.view).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      value: {
        chains: [
          {
            chain,
            current: {
              changedAt: at.toISOString(),
              changedBy: "Ada",
              feeUnits: "1500",
              treasury,
            },
            history: [
              {
                changedAt: new Date(at.getTime() - 3_600_000).toISOString(),
                changedBy: "Grace",
                feeUnits: "1000",
                treasury,
              },
              {
                changedAt: new Date(at.getTime() - 7_200_000).toISOString(),
                changedBy: null,
                feeUnits: "0",
                treasury,
              },
            ],
            maximumFeeUnits: "100000",
          },
        ],
      },
    });
  });
});

describe("setting the platform fee", () => {
  const input = { chain, feeUnits: "1500", treasury };

  it("names nobody when the staff member's account cannot be found, rather than failing a setting that was kept", async () => {
    const s = mintsStub({ names: new Map() });
    expect(await s.set.execute(input, context)).toMatchObject({
      value: { setting: { changedBy: null }, status: "saved" },
    });
  });

  it("is done as the signed-in staff member, never as someone the request names, with the fee and the address together", async () => {
    const s = mintsStub();
    const result = await s.set.execute(input, context);
    expect(s.fees.change).toHaveBeenCalledWith(staffId, chain, {
      feeSats: 1_500n,
      treasury,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        setting: {
          changedAt: at.toISOString(),
          changedBy: "Ada",
          feeUnits: "1500",
          treasury,
        },
        status: "saved",
      },
    });
  });

  it("says which rule a refused setting crossed, and the limit where there is one", async () => {
    const above = mintsStub({
      change: async () => ({
        code: "above-maximum",
        limit: 100_000n,
        ok: false,
      }),
    });
    expect(await above.set.execute(input, context)).toEqual({
      ok: true,
      value: {
        limitUnits: "100000",
        reason: "above-maximum",
        status: "refused",
      },
    });
    const invalid = mintsStub({
      change: async () => ({ code: "invalid-address", ok: false }),
    });
    expect(await invalid.set.execute(input, context)).toEqual({
      ok: true,
      value: { reason: "invalid-address", status: "refused" },
    });
  });

  it("refuses a chain no game is on, and writes nothing", async () => {
    const s = mintsStub();
    const result = await s.set.execute(
      { ...input, chain: chainRefSchema.parse("simnet:elsewhere") },
      context,
    );
    expect(result).toEqual({
      ok: true,
      value: { reason: "unknown-chain", status: "refused" },
    });
    expect(s.fees.change).not.toHaveBeenCalled();
  });

  it("takes the fee as whole units written as digits, an address, and a chain, and nothing more", () => {
    for (const bad of [
      { ...input, feeUnits: "-1" },
      { ...input, feeUnits: "1.5" },
      { ...input, feeUnits: "01" },
      { ...input, feeUnits: "" },
      { ...input, feeUnits: "99999999999999999999" },
      { ...input, treasury: "" },
      { ...input, by: staffId },
    ])
      expect(setPlatformFeeInputSchema.safeParse(bad).success).toBe(false);
    expect(setPlatformFeeInputSchema.safeParse(input).success).toBe(true);
    expect(
      setPlatformFeeInputSchema.safeParse({ ...input, feeUnits: "0" }).success,
    ).toBe(true);
  });
});

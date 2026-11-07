import { eq } from "drizzle-orm";
import { gameMilestoneClaims } from "@frostbite/database";
import { simulatedAddress } from "@frostbite/test-kit/simulated-chain-address";
import { describe, expect, it } from "vitest";

import {
  builtIntents,
  chain,
  database,
  gameId,
  player,
  platformFeeSetting,
  registerDatabase,
  reported,
  service,
  wallet,
} from "./support/fixture.ts";

registerDatabase();

const treasury = simulatedAddress(chain, "7ea5a1");
const start = (userId: string) =>
  service.start({
    gameId,
    milestoneId: "first-win",
    userId,
    wallet: wallet.value,
  });
// Every test works on its own player, and the database is shared by the whole file, so a test looks only at its player's rows.
const rowsOf = (userId: string) =>
  database
    .select()
    .from(gameMilestoneClaims)
    .where(eq(gameMilestoneClaims.userId, userId));

describe("a claim that carries the platform's fee", () => {
  it("asks the chain to pay the fee to the treasury, shows it in the summary and keeps it with the claim", async () => {
    platformFeeSetting.current = { feeSats: 1_500n, treasury: treasury.value };
    const userId = await player();
    const started = await start(userId);
    expect(started.ok).toBe(true);
    expect(builtIntents[0]).toMatchObject({
      platformFee: { baseUnits: 1_500n, recipient: treasury },
    });
    if (!started.ok) return;
    expect(started.claim.summary.platformFee).toMatchObject({
      amount: { baseUnits: 1_500n },
      recipient: treasury,
    });
    expect((await rowsOf(userId)).map((row) => row.platformFeeSats)).toEqual([
      1_500n,
    ]);
  });

  it("charges nothing, and builds no fee output, when no fee is set or it is zero", async () => {
    const userId = await player();
    platformFeeSetting.current = null;
    expect((await start(userId)).ok).toBe(true);
    expect(builtIntents[0]).not.toHaveProperty("platformFee");
    expect((await rowsOf(userId)).map((row) => row.platformFeeSats)).toEqual([
      0n,
    ]);

    const other = await player();
    platformFeeSetting.current = { feeSats: 0n, treasury: treasury.value };
    expect((await start(other)).ok).toBe(true);
    expect(builtIntents[1]).not.toHaveProperty("platformFee");
  });

  it("keeps what it was built with when the fee is changed afterwards: asking again returns the same claim, and the row says what was charged", async () => {
    const userId = await player();
    platformFeeSetting.current = { feeSats: 1_500n, treasury: treasury.value };
    const first = await start(userId);
    platformFeeSetting.current = { feeSats: 9_000n, treasury: treasury.value };
    const again = await start(userId);
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.resumed).toBe(true);
    expect(again.claim.id).toBe(first.claim.id);
    expect(again.claim.summary.platformFee?.amount.baseUnits).toBe(1_500n);
    const [row] = await database
      .select()
      .from(gameMilestoneClaims)
      .where(eq(gameMilestoneClaims.id, first.claim.id));
    expect(row?.platformFeeSats).toBe(1_500n);
  });

  it("starts no claim when the fee is set to an address the chain does not accept, and says why to the operator", async () => {
    platformFeeSetting.current = {
      feeSats: 1_500n,
      treasury: "not-an-address",
    };
    const userId = await player();
    const started = await start(userId);
    expect(started).toEqual({ code: "unavailable", ok: false });
    expect(builtIntents).toHaveLength(0);
    expect(await rowsOf(userId)).toHaveLength(0);
    expect(reported).toHaveLength(1);
  });

  it("starts no claim when the fee setting cannot be read", async () => {
    // A fee that was set and cannot be read must not become a claim that gives it away.
    platformFeeSetting.current = { feeSats: 1_500n, treasury: "" };
    expect(await start(await player())).toEqual({
      code: "unavailable",
      ok: false,
    });
  });
});

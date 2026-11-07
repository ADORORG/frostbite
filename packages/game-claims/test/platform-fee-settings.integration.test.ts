import { randomUUID } from "node:crypto";

import { platformFeeSettings } from "@frostbite/database";
import { simulatedAddress } from "@frostbite/test-kit/simulated-chain-address";
import {
  simulatedAddressCodec,
  simulatedMinimumOutput,
} from "@frostbite/test-kit/simulated-chain-address";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createPlatformFeeService } from "../src/platform-fee.ts";
import {
  chain,
  clock,
  database,
  otherChain,
  registerDatabase,
  seedUser,
} from "./support/fixture.ts";

registerDatabase();

const maximumFeeSats = 100_000n;
const treasury = simulatedAddress(chain, "7ea5a1");
const elsewhere = simulatedAddress(chain, "0ddba1");
const service = createPlatformFeeService({
  clock: () => clock.now,
  database,
  maximumFeeSats,
  newId: randomUUID,
  ports: (requested) =>
    requested === chain || requested === otherChain
      ? { addressCodec: simulatedAddressCodec }
      : null,
});
const rowsOn = (on: typeof chain) =>
  database
    .select()
    .from(platformFeeSettings)
    .where(eq(platformFeeSettings.chain, on));
// Each test sets a fee on a chain of its own so the others' settings are not in its way: the database lasts for the whole file.
let counter = 0;
const freshChain = () => {
  counter += 1;
  return `simnet:fee-${String(counter)}` as typeof chain;
};
// A service for the chains the tests make, whose addresses the simulated chain accepts.
const anywhere = createPlatformFeeService({
  clock: () => clock.now,
  database,
  maximumFeeSats,
  newId: randomUUID,
  ports: () => ({ addressCodec: simulatedAddressCodec }),
});

describe("the platform fee setting", () => {
  it("is none until staff set one, then the newest setting, with each earlier one kept as history and who made it", async () => {
    const on = freshChain();
    const staff = await seedUser();
    const other = await seedUser();
    const fees = anywhere;
    expect(await fees.setting(on)).toBeNull();
    expect(await fees.view(on, 10)).toMatchObject({
      current: null,
      history: [],
      maximumFeeSats,
    });

    const treasuryOn = simulatedAddress(on, "7ea5a1");
    clock.now = new Date("2026-10-16T12:00:00.000Z");
    expect(
      await fees.change(staff, on, {
        feeSats: 1_500n,
        treasury: treasuryOn.value,
      }),
    ).toMatchObject({ ok: true });
    clock.now = new Date("2026-10-16T13:00:00.000Z");
    await fees.change(other, on, {
      feeSats: 2_500n,
      treasury: treasuryOn.value,
    });

    expect(await fees.setting(on)).toEqual({
      feeSats: 2_500n,
      treasury: treasuryOn.value,
    });
    const view = await fees.view(on, 10);
    expect(view.current).toMatchObject({ changedBy: other, feeSats: 2_500n });
    expect(view.history).toHaveLength(1);
    expect(view.history[0]).toMatchObject({
      changedBy: staff,
      feeSats: 1_500n,
    });
  });

  it("charges nothing at zero, and still remembers the treasury it was set with", async () => {
    const on = freshChain();
    const fees = anywhere;
    const treasuryOn = simulatedAddress(on, "7ea5a1");
    await fees.change(await seedUser(), on, {
      feeSats: 0n,
      treasury: treasuryOn.value,
    });
    expect(await fees.setting(on)).toBeNull();
    expect((await fees.view(on, 10)).current).toMatchObject({
      feeSats: 0n,
      treasury: treasuryOn.value,
    });
  });

  it("keeps the settings of one chain from another's", async () => {
    const staff = await seedUser();
    const first = freshChain();
    const second = freshChain();
    const fees = anywhere;
    await fees.change(staff, first, {
      feeSats: 1_500n,
      treasury: simulatedAddress(first, "7ea5a1").value,
    });
    expect(await fees.setting(second)).toBeNull();
  });

  it("refuses an address the chain does not accept, naming nothing about it, and writes nothing", async () => {
    const on = freshChain();
    const fees = anywhere;
    expect(
      await fees.change(await seedUser(), on, {
        feeSats: 1_500n,
        treasury: "not-an-address",
      }),
    ).toEqual({ code: "invalid-address", ok: false });
    // An address of another chain is not an address on this one.
    expect(
      await fees.change(await seedUser(), on, {
        feeSats: 1_500n,
        treasury: elsewhere.value,
      }),
    ).toEqual({ code: "invalid-address", ok: false });
    expect(await rowsOn(on)).toHaveLength(0);
  });

  it("refuses a fee below the least an output may carry, but takes exactly that, and zero", async () => {
    const on = freshChain();
    const fees = anywhere;
    const treasuryOn = simulatedAddress(on, "7ea5a1").value;
    const staff = await seedUser();
    expect(
      await fees.change(staff, on, {
        feeSats: simulatedMinimumOutput - 1n,
        treasury: treasuryOn,
      }),
    ).toEqual({
      code: "below-minimum-output",
      limit: simulatedMinimumOutput,
      ok: false,
    });
    expect(
      await fees.change(staff, on, {
        feeSats: simulatedMinimumOutput,
        treasury: treasuryOn,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await fees.change(staff, on, { feeSats: 0n, treasury: treasuryOn }),
    ).toMatchObject({ ok: true });
    expect(await rowsOn(on)).toHaveLength(2);
  });

  it("refuses a fee above the most policy allows, and takes exactly that", async () => {
    const on = freshChain();
    const fees = anywhere;
    const treasuryOn = simulatedAddress(on, "7ea5a1").value;
    const staff = await seedUser();
    expect(
      await fees.change(staff, on, {
        feeSats: maximumFeeSats + 1n,
        treasury: treasuryOn,
      }),
    ).toEqual({ code: "above-maximum", limit: maximumFeeSats, ok: false });
    expect(
      await fees.change(staff, on, {
        feeSats: maximumFeeSats,
        treasury: treasuryOn,
      }),
    ).toMatchObject({ ok: true });
  });

  it("refuses a chain the platform does not serve", async () => {
    expect(
      await service.change(
        await seedUser(),
        "simnet:unserved" as typeof chain,
        {
          feeSats: 1_500n,
          treasury: treasury.value,
        },
      ),
    ).toEqual({ code: "chain-unavailable", ok: false });
  });

  it("reads the newest setting by the index: no sort, however many settings there are", async () => {
    const on = freshChain();
    const staff = await seedUser();
    await database.insert(platformFeeSettings).values(
      Array.from({ length: 300 }, (_unused, index) => ({
        chain: on,
        changedBy: staff,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        feeSats: BigInt(index),
        id: randomUUID(),
        treasuryAddress: simulatedAddress(on, "7ea5a1").value,
      })),
    );
    await database.execute(sql`analyze frostbite.platform_fee_settings`);
    const plan = await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local enable_seqscan = off`);
      return transaction.execute(
        sql`explain select * from frostbite.platform_fee_settings where chain = ${on} order by created_at desc nulls last limit 1`,
      );
    });
    const text = JSON.stringify(plan);
    expect(text).toContain("platform_fee_settings_chain_newest_idx");
    expect(text).not.toContain("Sort");
  });
});

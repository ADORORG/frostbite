import { randomUUID } from "node:crypto";

import { gameMilestoneClaims } from "@frostbite/database";
import { describe, expect, it } from "vitest";

import {
  chain,
  contract,
  database,
  newClaim,
  registerDatabase,
  repository,
  seedUser,
  wallet,
} from "./support/fixture.ts";

registerDatabase();

const sentAt = new Date("2026-10-16T12:30:00.000Z");
const base = (userId: string) => ({
  chain,
  contractFamily: contract.family,
  contractId: contract.id,
  expectedClaims: 1,
  expiresAt: new Date("2026-10-16T13:00:00.000Z"),
  gameId: "arcade",
  id: randomUUID(),
  milestoneId: "first-win",
  state: "awaiting_signature",
  summary: {},
  unsignedFamily: "simulated",
  unsignedFormat: "sim-json/1",
  unsignedPayload: "{}",
  userId,
  walletAddress: wallet.value,
});
const insert = (values: object) =>
  database.insert(gameMilestoneClaims).values(values as never);
const refusal = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    // The driver wraps the database's error; the constraint's name is in its cause.
    const cause = (error as { cause?: { constraint?: string } }).cause;
    return cause?.constraint ?? "other";
  }
};

describe("what the claims table refuses by itself", () => {
  it("accepts a plain claim awaiting its signature", async () => {
    expect(await refusal(insert(base(await seedUser())))).toBeNull();
  });

  it.each([
    [
      "a state that is not one",
      {
        broadcastAt: sentAt,
        signedPayload: "x.sig",
        state: "minted",
        transactionId: "t",
      },
      "game_milestone_claims_state_known",
    ],
    [
      "an expectation of no claims",
      { expectedClaims: 0 },
      "game_milestone_claims_expected_positive",
    ],
    [
      "a payload over the limit",
      { unsignedPayload: "x".repeat(65_537) },
      "game_milestone_claims_payload_bounded",
    ],
    [
      "a signed claim with nothing signed",
      { state: "signed", transactionId: null },
      "game_milestone_claims_signed_coherent",
    ],
    [
      "a claim awaiting a signature that has one",
      { signedPayload: "x.sig" },
      "game_milestone_claims_signed_coherent",
    ],
    [
      "a broadcast claim with no transaction id",
      { signedPayload: "x.sig", state: "broadcast_accepted" },
      "game_milestone_claims_transaction_coherent",
    ],
    [
      "a transaction id before the network answered",
      { broadcastAt: sentAt, transactionId: "abc" },
      "game_milestone_claims_transaction_coherent",
    ],
    [
      "a claim sent with no time recorded",
      {
        signedPayload: "x.sig",
        state: "broadcast_accepted",
        transactionId: "t",
      },
      "game_milestone_claims_broadcast_coherent",
    ],
    [
      "a time of sending on a claim the network never answered",
      { broadcastAt: sentAt },
      "game_milestone_claims_broadcast_coherent",
    ],
    [
      "a rejection with no reason",
      { signedPayload: "x.sig", state: "broadcast_rejected" },
      "game_milestone_claims_failure_coherent",
    ],
    [
      "a reason on a claim that did not fail",
      { failureReason: "why" },
      "game_milestone_claims_failure_coherent",
    ],
  ])("refuses %s", async (_name, change, constraint) => {
    expect(
      await refusal(insert({ ...base(await seedUser()), ...change })),
    ).toBe(constraint);
  });

  it("accepts each claim that has the fields its state needs", async () => {
    const userId = await seedUser();
    const signed = { signedPayload: "x.sig" };
    expect(
      await refusal(
        insert({
          ...base(userId),
          milestoneId: "a1",
          ...signed,
          state: "broadcast_rejected",
          failureReason: "no",
        }),
      ),
    ).toBeNull();
    expect(
      await refusal(
        insert({
          ...base(userId),
          milestoneId: "a2",
          ...signed,
          state: "indexed_failure",
          failureReason: "no",
          broadcastAt: sentAt,
          transactionId: "t",
        }),
      ),
    ).toBeNull();
    expect(
      await refusal(
        insert({
          ...base(userId),
          milestoneId: "a3",
          ...signed,
          state: "complete",
          broadcastAt: sentAt,
          transactionId: "t",
        }),
      ),
    ).toBeNull();
    expect(
      await refusal(
        insert({ ...base(userId), milestoneId: "a4", state: "expired" }),
      ),
    ).toBeNull();
  });

  it("lets a player have one claim in progress per milestone, and any number settled", async () => {
    const userId = await seedUser();
    expect(await refusal(insert(base(userId)))).toBeNull();
    expect(await refusal(insert(base(userId)))).toBe(
      "game_milestone_claims_one_in_progress_idx",
    );
    expect(
      await refusal(insert({ ...base(userId), milestoneId: "other" })),
    ).toBeNull();
    const done = {
      ...base(userId),
      signedPayload: "x.sig",
      state: "complete",
      broadcastAt: sentAt,
      transactionId: "t",
    };
    expect(await refusal(insert(done))).toBeNull();
    expect(await refusal(insert({ ...done, id: randomUUID() }))).toBeNull();
  });

  it("goes with the player", async () => {
    const userId = await seedUser();
    await insert(base(userId));
    await database.execute(
      `delete from frostbite.auth_users where id = '${userId}'`,
    );
    expect(
      await database.select().from(gameMilestoneClaims),
    ).not.toContainEqual(expect.objectContaining({ userId }));
  });
});

describe("starting many claims of one milestone at once", () => {
  it("makes exactly one claim, and hands the rest the one in progress", async () => {
    const userId = await seedUser();
    const results = await Promise.all(
      Array.from({ length: 60 }, async () =>
        repository.create(await newClaim(userId), { limit: 1 }),
      ),
    );
    expect(results.filter(({ kind }) => kind === "created")).toHaveLength(1);
    expect(results.filter(({ kind }) => kind === "in-progress")).toHaveLength(
      59,
    );
    const rows = await database.select().from(gameMilestoneClaims);
    expect(rows.filter((row) => row.userId === userId)).toHaveLength(1);
  });
});

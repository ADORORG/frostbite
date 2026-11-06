import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  passkeyChallenges,
  passkeySignInChallenges,
  removeExpiredRows,
  contactCodes,
  walletChallenges,
} from "../src/index.ts";
import {
  aSession,
  aUser,
  ago,
  code,
  database,
  hour,
  left,
  limits,
  minute,
  now,
  useExpiredRowsWorld,
  wallet,
} from "./support/expired-rows-world.ts";

useExpiredRowsWorld();

describe("wallet and passkey challenges", () => {
  it("removes the ones that have expired and keeps the ones that have not", async () => {
    await database
      .insert(walletChallenges)
      .values([wallet(10 * minute, 5 * minute), wallet(minute, -minute)]);
    const userId = await aUser();
    const sessionId = await aSession(userId);
    await database.insert(passkeyChallenges).values(
      [
        { expiresAgo: 5 * minute, issuedAgo: 10 * minute },
        { expiresAgo: -minute, issuedAgo: minute },
      ].map(({ expiresAgo, issuedAgo }) => ({
        challengeHash: "d".repeat(64),
        expiresAt: ago(expiresAgo),
        id: randomUUID(),
        issuedAt: ago(issuedAgo),
        origin: "https://example.test",
        relyingPartyId: "example.test",
        sessionId,
        userId,
      })),
    );
    expect(await removeExpiredRows(database, now, limits)).toMatchObject({
      passkeyChallenges: 1,
      walletChallenges: 1,
    });
    expect(await left(walletChallenges)).toBe(1);
    expect(
      (await database.select().from(passkeyChallenges)).map(
        ({ expiresAt }) => expiresAt,
      ),
    ).toEqual([ago(-minute)]);
  });

  it("removes an expired challenge whether or not it was used, and one that expires this very moment is kept", async () => {
    const used = {
      ...wallet(10 * minute, 5 * minute),
      consumedAt: ago(8 * minute),
    };
    await database
      .insert(walletChallenges)
      .values([used, wallet(10 * minute, 0)]);
    const counts = await removeExpiredRows(database, now, limits);
    expect(counts.walletChallenges).toBe(1);
    expect(await left(walletChallenges)).toBe(1);
  });
});

describe("passkey sign-in challenges", () => {
  it("removes the ones that have expired and keeps the ones that have not", async () => {
    await database.insert(passkeySignInChallenges).values(
      [
        { expiresAgo: 5 * minute, issuedAgo: 10 * minute },
        { expiresAgo: -minute, issuedAgo: minute },
      ].map(({ expiresAgo, issuedAgo }) => ({
        challengeHash: "e".repeat(64),
        expiresAt: ago(expiresAgo),
        id: randomUUID(),
        issuedAt: ago(issuedAgo),
        origin: "https://example.test",
        relyingPartyId: "example.test",
      })),
    );
    expect(
      (await removeExpiredRows(database, now, limits)).passkeySignInChallenges,
    ).toBe(1);
    expect(
      (await database.select().from(passkeySignInChallenges)).map(
        ({ expiresAt }) => expiresAt,
      ),
    ).toEqual([ago(-minute)]);
  });
});

describe("contact codes", () => {
  it("keeps a code that expired but is still inside the send limits' look-back, because the limits count it", async () => {
    // Issued 20 minutes ago, expired 10 minutes ago: dead, but one of the codes the next request is counted against.
    await database.insert(contactCodes).values(code(20 * minute, 10 * minute));
    expect((await removeExpiredRows(database, now, limits)).contactCodes).toBe(
      0,
    );
    expect(await left(contactCodes)).toBe(1);
  });

  it("removes a code once it has expired and is older than the look-back", async () => {
    await database
      .insert(contactCodes)
      .values([code(2 * hour, 110 * minute), code(20 * minute, 10 * minute)]);
    expect((await removeExpiredRows(database, now, limits)).contactCodes).toBe(
      1,
    );
    expect(await left(contactCodes)).toBe(1);
  });

  it("keeps a code that is older than the look-back but has not expired (a retention shorter than its life must not cut it short)", async () => {
    await database.insert(contactCodes).values(code(2 * hour, -hour));
    expect(
      (
        await removeExpiredRows(database, now, {
          ...limits,
          contactCodeRetentionMs: minute,
        })
      ).contactCodes,
    ).toBe(0);
    expect(await left(contactCodes)).toBe(1);
  });
});

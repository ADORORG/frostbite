import { describe, expect, it } from "vitest";

import {
  chain,
  clock,
  gameId,
  network,
  player,
  registerDatabase,
  seedUser,
  service,
  startAndSign,
} from "./support/fixture.ts";

registerDatabase();

// Takes a claim of the milestone all the way to complete, as the network's records would show it.
async function mint(userId: string, milestoneId: string) {
  const { claim, signed } = await startAndSign(userId, milestoneId);
  const submitted = await service.submitSigned({
    claimId: claim.id,
    signed,
    userId,
  });
  if (!submitted.ok) throw new Error(submitted.code);
  network.controls.advance(chain, 3);
  await service.refresh(userId, claim.id);
  await service.refresh(userId, claim.id);
  return { claim, transactionId: submitted.claim.transactionId };
}

describe("what a player has minted", () => {
  it("is empty for a player with no claims", async () => {
    expect(await service.minted(await seedUser())).toEqual([]);
  });

  it("lists a claim only once the network's records show it complete", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    expect(await service.minted(userId)).toEqual([]);
    await service.submitSigned({ claimId: claim.id, signed, userId });
    network.controls.advance(chain, 3);
    await service.refresh(userId, claim.id);
    // Confirmed on the network but not yet in its indexed state: not minted yet.
    expect(await service.minted(userId)).toEqual([]);
    await service.refresh(userId, claim.id);
    const [only, ...rest] = await service.minted(userId);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({
      claimId: claim.id,
      gameId,
      milestoneId: "first-win",
    });
    expect(only?.transactionId).toEqual(expect.any(String));
  });

  it("gives the network's id for the transaction and the time it was recorded complete, newest first", async () => {
    const userId = await player();
    const first = await mint(userId, "first-win");
    clock.now = new Date(clock.now.getTime() + 60_000);
    const second = await mint(userId, "streak");
    const listed = await service.minted(userId);
    expect(listed.map((item) => item.milestoneId)).toEqual([
      "streak",
      "first-win",
    ]);
    expect(listed.map((item) => item.transactionId)).toEqual([
      second.transactionId,
      first.transactionId,
    ]);
    expect(Date.parse(listed[0]?.mintedAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(listed[1]?.mintedAt ?? ""),
    );
  });

  it("never lists another player's mints", async () => {
    const mine = await player();
    await mint(mine, "first-win");
    expect(await service.minted(await seedUser())).toEqual([]);
  });
});

import { eq } from "drizzle-orm";
import { gameMilestoneClaims } from "@ador/database";
import { describe, expect, it } from "vitest";

import {
  chain,
  chainAvailable,
  claimableGame,
  contract,
  database,
  game,
  gameId,
  indexerLag,
  network,
  player,
  registerDatabase,
  service,
  seedUser,
  startAndSign,
  wallet,
} from "./support/fixture.ts";

registerDatabase();

const rowOf = async (id: string) =>
  (
    await database
      .select()
      .from(gameMilestoneClaims)
      .where(eq(gameMilestoneClaims.id, id))
  )[0];

describe("claiming a milestone from the start to complete", () => {
  it("builds the transaction, shows what it does, and keeps it awaiting the wallet", async () => {
    const userId = await player();
    const started = await service.start({
      gameId,
      milestoneId: "first-win",
      userId,
      wallet: wallet.value,
    });
    if (!started.ok) throw new Error("did not start");
    expect(started.resumed).toBe(false);
    expect(started.claim).toMatchObject({
      failureReason: null,
      gameId,
      milestoneId: "first-win",
      state: "awaiting_signature",
      transactionId: null,
      wallet,
    });
    expect(started.claim.summary).toMatchObject({
      milestone: { contract, id: "first-win" },
      operation: "mint-milestone",
      recipient: wallet,
    });
    expect(started.claim.toSign?.summary).toEqual(started.claim.summary);
    expect(await rowOf(started.claim.id)).toMatchObject({
      expectedClaims: 1,
      signedPayload: null,
      state: "awaiting_signature",
    });
  });

  it("goes through signing, the network, confirmation and indexing, one honest state at a time", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);

    const submitted = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    if (!submitted.ok) throw new Error(submitted.code);
    expect(submitted.claim).toMatchObject({
      state: "broadcast_accepted",
      toSign: null,
    });
    expect(submitted.claim.transactionId).not.toBeNull();

    // Seen by the network, not yet deep enough.
    const pending = await service.refresh(userId, claim.id);
    expect(pending.ok && pending.claim.state).toBe("pending");
    network.controls.advance(chain, 2);
    expect((await service.refresh(userId, claim.id)).ok).toBe(true);
    expect(
      ((await service.list(userId, gameId))[0] ?? { state: "" }).state,
    ).toBe("pending");

    // Deep enough, and the chain's own state shows the claim: confirmed, then complete on the next look.
    network.controls.advance(chain, 1);
    const confirmed = await service.refresh(userId, claim.id);
    expect(confirmed.ok && confirmed.claim.state).toBe("confirmed");
    const complete = await service.refresh(userId, claim.id);
    expect(complete.ok && complete.claim.state).toBe("complete");
    expect(await rowOf(claim.id)).toMatchObject({
      failureReason: null,
      state: "complete",
    });
    // A settled claim stays as it is.
    const again = await service.refresh(userId, claim.id);
    expect(again.ok && again.claim.state).toBe("complete");
  });

  it("returns the claim in progress when asked again, instead of a second one", async () => {
    const userId = await player();
    const first = await startAndSign(userId);
    const again = await service.start({
      gameId,
      milestoneId: "first-win",
      userId,
      wallet: wallet.value,
    });
    expect(again.ok && again.resumed).toBe(true);
    expect(again.ok && again.claim.id).toBe(first.claim.id);
    expect(await service.list(userId, gameId)).toHaveLength(1);
  });

  it("makes one claim when two starts arrive together", async () => {
    const userId = await player();
    const starts = await Promise.all(
      [1, 2, 3].map(() =>
        service.start({
          gameId,
          milestoneId: "first-win",
          userId,
          wallet: wallet.value,
        }),
      ),
    );
    const ids = new Set(starts.map((s) => (s.ok ? s.claim.id : "failed")));
    expect(ids.size).toBe(1);
    expect(starts.filter((s) => s.ok && !s.resumed)).toHaveLength(1);
    expect(await service.list(userId, gameId)).toHaveLength(1);
  });

  it("lets a milestone claimed as often as its policy allows be claimed no more", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    await service.submitSigned({ claimId: claim.id, signed, userId });
    network.controls.advance(chain, 3);
    await service.refresh(userId, claim.id);
    await service.refresh(userId, claim.id);
    await service.refresh(userId, claim.id);
    expect(
      await service.start({
        gameId,
        milestoneId: "first-win",
        userId,
        wallet: wallet.value,
      }),
    ).toEqual({ code: "limit-reached", ok: false });
    // Another milestone of the same game is a different claim, and one with room is open.
    expect(
      (
        await service.start({
          gameId,
          milestoneId: "streak",
          userId,
          wallet: wallet.value,
        })
      ).ok,
    ).toBe(true);
  });

  it("expects the chain to show every claim the wallet has completed, so a second claim is counted from its own", async () => {
    const userId = await player();
    const first = await startAndSign(userId, "streak");
    await service.submitSigned({
      claimId: first.claim.id,
      signed: first.signed,
      userId,
    });
    network.controls.advance(chain, 3);
    for (let look = 0; look < 3; look += 1)
      await service.refresh(userId, first.claim.id);

    const second = await startAndSign(userId, "streak");
    expect(await rowOf(second.claim.id)).toMatchObject({ expectedClaims: 2 });
    await service.submitSigned({
      claimId: second.claim.id,
      signed: second.signed,
      userId,
    });
    network.controls.advance(chain, 3);
    await service.refresh(userId, second.claim.id);
    const done = await service.refresh(userId, second.claim.id);
    expect(done.ok && done.claim.state).toBe("complete");
  });

  it("stays confirmed while the indexer is behind the chain, and is complete only when it catches up", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    await service.submitSigned({ claimId: claim.id, signed, userId });
    network.controls.advance(chain, 3);
    await service.refresh(userId, claim.id);
    indexerLag.on = true;
    for (let look = 0; look < 3; look += 1) {
      const waiting = await service.refresh(userId, claim.id);
      expect(waiting.ok && waiting.claim.state).toBe("confirmed");
    }
    indexerLag.on = false;
    const caught = await service.refresh(userId, claim.id);
    expect(caught.ok && caught.claim.state).toBe("complete");
  });

  it("is refused when it is not claimable, not earned, on another chain, or has no contract yet", async () => {
    const userId = await player();
    const ask = (over: object = {}) =>
      service.start({
        gameId,
        milestoneId: "first-win",
        userId,
        wallet: wallet.value,
        ...over,
      });
    expect(await ask({ gameId: "unknown-game" })).toEqual({
      code: "not-claimable",
      ok: false,
    });
    expect(await ask({ milestoneId: "nothing" })).toEqual({
      code: "not-claimable",
      ok: false,
    });
    expect(await ask({ userId: await seedUser() })).toEqual({
      code: "not-earned",
      ok: false,
    });
    expect(await ask({ wallet: "not-an-address" })).toEqual({
      code: "wrong-chain",
      ok: false,
    });
    game.current = { ...claimableGame(), contract: null };
    expect(await ask()).toEqual({ code: "unavailable", ok: false });
    chainAvailable.value = false;
    game.current = claimableGame();
    expect(await ask()).toEqual({ code: "unavailable", ok: false });
    expect(await service.list(userId, gameId)).toEqual([]);
  });

  it("lets claims be listed for the player and the game, in the order they were made", async () => {
    const userId = await player();
    await startAndSign(userId, "first-win");
    await startAndSign(userId, "streak");
    expect(
      (await service.list(userId, gameId)).map(
        ({ milestoneId }) => milestoneId,
      ),
    ).toEqual(["first-win", "streak"]);
    expect(await service.list(await player(), gameId)).toEqual([]);
    expect(await service.list(userId, "another-game")).toEqual([]);
  });
});

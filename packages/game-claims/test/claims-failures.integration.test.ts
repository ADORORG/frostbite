import { gameMilestoneClaims } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  broadcastGate,
  chain,
  chainFailure,
  clock,
  database,
  gameId,
  network,
  player,
  registerDatabase,
  seedUser,
  service,
  startAndSign,
  wallet,
} from "./support/fixture.ts";

registerDatabase();

const stateOf = async (id: string) =>
  (
    await database
      .select()
      .from(gameMilestoneClaims)
      .where(eq(gameMilestoneClaims.id, id))
  )[0];
const refreshed = async (userId: string, id: string) => {
  const result = await service.refresh(userId, id);
  if (!result.ok) throw new Error(result.code);
  return result.claim;
};

describe("signing", () => {
  it("refuses what the wallet did not sign as shown, keeps the claim waiting, and takes the right signature after", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    const tampered = { ...signed, payload: `x${signed.payload}` };
    expect(
      await service.submitSigned({
        claimId: claim.id,
        signed: tampered,
        userId,
      }),
    ).toEqual({
      code: "invalid-signature",
      ok: false,
      reason: "payload-mismatch",
    });
    expect((await stateOf(claim.id))?.state).toBe("awaiting_signature");
    expect((await stateOf(claim.id))?.signedPayload).toBeNull();
    const retried = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    expect(retried.ok && retried.claim.state).toBe("broadcast_accepted");
  });

  it("takes the same signed claim twice without sending it twice, and refuses a different one once it is signed", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    const first = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    const second = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    expect(first.ok && first.claim.transactionId).toBeTruthy();
    expect(second.ok && second.claim.transactionId).toBe(
      first.ok && first.claim.transactionId,
    );
    expect(
      await service.submitSigned({
        claimId: claim.id,
        signed: { ...signed, payload: `${signed.payload}.sig` },
        userId,
      }),
    ).toEqual({ code: "not-awaiting-signature", ok: false });
  });

  it("does not let another player sign a claim, or even learn that it exists", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    const other = await seedUser();
    expect(
      await service.submitSigned({ claimId: claim.id, signed, userId: other }),
    ).toEqual({
      code: "not-found",
      ok: false,
    });
    expect(await service.refresh(other, claim.id)).toEqual({
      code: "not-found",
      ok: false,
    });
    expect((await stateOf(claim.id))?.state).toBe("awaiting_signature");
  });

  it("refuses a claim signed after its quote ran out, marks it expired, and lets a new one start", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    clock.now = new Date(Date.parse(claim.expiresAt) + 1);
    expect(
      await service.submitSigned({ claimId: claim.id, signed, userId }),
    ).toEqual({
      code: "expired",
      ok: false,
    });
    expect((await stateOf(claim.id))?.state).toBe("expired");
    const next = await service.start({
      gameId,
      milestoneId: "first-win",
      userId,
      wallet: wallet.value,
    });
    expect(next.ok && next.resumed).toBe(false);
    expect(next.ok && next.claim.id).not.toBe(claim.id);
  });

  it("lets a quote that ran out expire when the player starts again or when it is looked at, whichever comes first", async () => {
    const userId = await player();
    const looked = await startAndSign(userId, "first-win");
    clock.now = new Date(Date.parse(looked.claim.expiresAt) + 1);
    expect((await refreshed(userId, looked.claim.id)).state).toBe("expired");
    const restarted = await startAndSign(userId, "first-win");
    clock.now = new Date(Date.parse(restarted.claim.expiresAt) + 1);
    const fresh = await service.start({
      gameId,
      milestoneId: "first-win",
      userId,
      wallet: wallet.value,
    });
    expect(fresh.ok && fresh.claim.id).not.toBe(restarted.claim.id);
    expect((await stateOf(restarted.claim.id))?.state).toBe("expired");
  });
});

describe("steps that overlap", () => {
  it("does not let a late step overwrite what an earlier one settled", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    // The player's signature is kept but its broadcast cannot be made yet.
    chainFailure.broadcast = true;
    await service.submitSigned({ claimId: claim.id, signed, userId });
    chainFailure.broadcast = false;
    expect((await stateOf(claim.id))?.state).toBe("signed");

    // Two looks both find it signed and both send it; the network rejects the first send and takes the second.
    broadcastGate.enabled = true;
    const first = service.refresh(userId, claim.id);
    const second = service.refresh(userId, claim.id);
    while (broadcastGate.held.length < 2)
      await new Promise((wake) => setTimeout(wake, 5));
    network.controls.failNext(chain, "rejected");
    broadcastGate.held[0]?.();
    await first;
    broadcastGate.held[1]?.();
    // The late look is told how the claim stands, not that the chain failed, and writes nothing.
    const late = await second;
    expect(late.ok && late.claim.state).toBe("broadcast_rejected");
    expect(await stateOf(claim.id)).toMatchObject({
      state: "broadcast_rejected",
      transactionId: null,
    });
  });
});

describe("the network", () => {
  it("records a rejection with its reason, and lets the player claim again", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    network.controls.failNext(chain, "rejected");
    const result = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    expect(result.ok && result.claim).toMatchObject({
      failureReason: "rejected by the simulated network",
      state: "broadcast_rejected",
      transactionId: null,
    });
    const again = await service.start({
      gameId,
      milestoneId: "first-win",
      userId,
      wallet: wallet.value,
    });
    expect(again.ok && again.resumed).toBe(false);
  });

  it("keeps a signed claim that the network could not be reached with, and sends the same bytes on the next look", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    network.controls.failNext(chain, "unavailable");
    const result = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    expect(result.ok && result.claim.state).toBe("signed");
    expect((await stateOf(claim.id))?.signedPayload).toBe(signed.payload);
    expect((await refreshed(userId, claim.id)).state).toBe(
      "broadcast_accepted",
    );
  });

  it("resolves a broadcast of unknown outcome by looking the transaction up, never by sending again", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    network.controls.failNext(chain, "ambiguous");
    const result = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    expect(result.ok && result.claim.state).toBe("broadcast_unknown");
    const id = result.ok ? result.claim.transactionId : null;
    expect(id).not.toBeNull();
    expect((await refreshed(userId, claim.id)).state).toBe("pending");
    expect((await stateOf(claim.id))?.transactionId).toBe(id);
  });

  it("records a claim the network included and then reverted as a failure, with no effect, and lets the player claim again", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    const sent = await service.submitSigned({
      claimId: claim.id,
      signed,
      userId,
    });
    const ref = { chain, id: sent.ok ? (sent.claim.transactionId ?? "") : "" };
    network.controls.advance(chain, 3);
    network.controls.revert(ref);
    const failed = await refreshed(userId, claim.id);
    expect(failed).toMatchObject({
      failureReason: "reverted by the network",
      state: "indexed_failure",
    });
    expect(
      await service.start({
        gameId,
        milestoneId: "first-win",
        userId,
        wallet: wallet.value,
      }),
    ).toMatchObject({
      ok: true,
      resumed: false,
    });
  });

  it("leaves the claim as it is when the chain cannot be asked, and says so", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    await service.submitSigned({ claimId: claim.id, signed, userId });
    chainFailure.observe = true;
    expect(await service.refresh(userId, claim.id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect((await stateOf(claim.id))?.state).toBe("broadcast_accepted");
    chainFailure.observe = false;
    expect((await refreshed(userId, claim.id)).state).toBe("pending");
  });

  it("does not move a claim that is not yet sent, or one that is settled, when looked at", async () => {
    const userId = await player();
    const { claim } = await startAndSign(userId);
    expect((await refreshed(userId, claim.id)).state).toBe(
      "awaiting_signature",
    );
  });
});

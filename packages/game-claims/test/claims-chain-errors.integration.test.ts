import { gameMilestoneClaims } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { BuildRefusedError, ChainUnavailableError } from "@ador/chain/ports";
import {
  chainAvailable,
  chainFailure,
  database,
  gameId,
  network,
  player,
  registerDatabase,
  reported,
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
  )[0]?.state;

const start = async (userId: string) =>
  service.start({
    gameId,
    milestoneId: "first-win",
    userId,
    wallet: wallet.value,
  });

describe("starting when the chain is not behaving", () => {
  it.each([
    ["claims are paused", "claims-paused"],
    ["Error: unknown milestone", "milestone-not-defined"],
    ["claim limit reached", "limit-reached"],
    ["something the contract invented", "contract-refused"],
  ] as const)(
    "tells apart what the contract says (%s) and keeps nothing",
    async (said, code) => {
      const userId = await player();
      chainFailure.simulate = said;
      expect(await start(userId)).toEqual({ code, ok: false });
      expect(await service.list(userId, gameId)).toEqual([]);
      // A contract's refusal is an answer, not a failure to look into.
      expect(reported).toEqual([]);
    },
  );

  it("says the wallet has no confirmed coins, and does not report it as a failure", async () => {
    const userId = await player();
    chainFailure.build = new BuildRefusedError(
      "insufficient-funds",
      "The sender's confirmed balance cannot pay for the claim.",
    );
    expect(await start(userId)).toEqual({ code: "no-funds", ok: false });
    expect(await service.list(userId, gameId)).toEqual([]);
    expect(reported).toEqual([]);
  });

  it("says the index is behind the chain, whether it failed the simulation or the building, without reporting it", async () => {
    const userId = await player();
    chainFailure.build = new ChainUnavailableError("index behind", "behind");
    expect(await start(userId)).toEqual({ code: "index-behind", ok: false });
    expect(reported).toEqual([]);
    expect(await service.list(userId, gameId)).toEqual([]);
  });

  it("says the fee is above what the platform allows", async () => {
    const userId = await player();
    chainFailure.build = new BuildRefusedError("fee-above-limit", "too dear");
    expect(await start(userId)).toEqual({ code: "fee-too-high", ok: false });
    expect(reported).toEqual([]);
  });

  it("says the chain is unavailable when the transaction cannot be built for any other reason, keeps nothing, and reports why", async () => {
    const userId = await player();
    chainFailure.build = true;
    expect(await start(userId)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect(await service.list(userId, gameId)).toEqual([]);
    expect(reported).toEqual([
      { error: new Error("the node is down"), step: "start" },
    ]);
  });

  it("does not take a refusal the platform cannot act on for a fee or funds problem", async () => {
    const userId = await player();
    chainFailure.build = new BuildRefusedError("invalid-request", "bad");
    expect(await start(userId)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect(reported).toHaveLength(1);
  });
});

describe("signing and looking when the chain is not behaving", () => {
  it("keeps the signed claim when the broadcast throws, and sends it on the next look", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    chainFailure.broadcast = true;
    expect(
      await service.submitSigned({ claimId: claim.id, signed, userId }),
    ).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect(await stateOf(claim.id)).toBe("signed");
    expect(await service.refresh(userId, claim.id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    chainFailure.broadcast = false;
    const sent = await service.refresh(userId, claim.id);
    expect(sent.ok && sent.claim.state).toBe("broadcast_accepted");
  });

  it("refuses to take a signature while the chain is not served, and leaves the claim waiting", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    chainAvailable.value = false;
    expect(
      await service.submitSigned({ claimId: claim.id, signed, userId }),
    ).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect(await service.refresh(userId, claim.id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect(await stateOf(claim.id)).toBe("awaiting_signature");
  });

  it("leaves a claim whose signature was taken but could not be sent for the next look when the chain stops being served", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    chainFailure.broadcast = true;
    await service.submitSigned({ claimId: claim.id, signed, userId });
    chainFailure.broadcast = false;
    chainAvailable.value = false;
    expect(await service.refresh(userId, claim.id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect(await stateOf(claim.id)).toBe("signed");
  });

  it("does not look at the chain for a claim that failed to send, and shows it as it is", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    network.controls.failNext(claim.summary.chain, "rejected");
    await service.submitSigned({ claimId: claim.id, signed, userId });
    chainFailure.observe = true;
    const shown = await service.refresh(userId, claim.id);
    expect(shown.ok && shown.claim.state).toBe("broadcast_rejected");
  });
});

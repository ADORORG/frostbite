import { gameMilestoneClaims } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  chainAvailable,
  chainFailure,
  database,
  gameId,
  network,
  player,
  registerDatabase,
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

describe("starting when the chain is not behaving", () => {
  it("says what the contract would refuse, and keeps nothing", async () => {
    const userId = await player();
    chainFailure.simulate = true;
    expect(
      await service.start({ gameId, milestoneId: "first-win", userId, wallet }),
    ).toEqual({
      code: "would-fail",
      ok: false,
      reason: "the contract would refuse it",
    });
    expect(await service.list(userId, gameId)).toEqual([]);
  });

  it("says the chain is unavailable when the transaction cannot be built, and keeps nothing", async () => {
    const userId = await player();
    chainFailure.build = true;
    expect(
      await service.start({ gameId, milestoneId: "first-win", userId, wallet }),
    ).toEqual({ code: "chain-unavailable", ok: false });
    expect(await service.list(userId, gameId)).toEqual([]);
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

import { gameMilestoneClaims } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  chain,
  clock,
  database,
  indexer,
  network,
  player,
  registerDatabase,
  service,
  startAndSign,
} from "./support/fixture.ts";

registerDatabase();

const minutes = (count: number) => count * 60_000;

async function sentClaim() {
  const userId = await player();
  const { claim, signed } = await startAndSign(userId);
  const sent = await service.submitSigned({
    claimId: claim.id,
    signed,
    userId,
  });
  if (!sent.ok) throw new Error("not sent");
  return { claim: sent.claim, userId };
}

const refreshed = async (userId: string, id: string) => {
  const result = await service.refresh(userId, id);
  if (!result.ok) throw new Error("not refreshed");
  return result.claim;
};

describe("a claim that is taking long", () => {
  it("records when it was sent, once, and does not move that time when later news arrives", async () => {
    const { claim, userId } = await sentClaim();
    expect(claim.sentAt).toBe(clock.now.toISOString());
    clock.now = new Date(clock.now.getTime() + minutes(5));
    network.controls.advance(chain, 3);
    const confirmed = await refreshed(userId, claim.id);
    expect(confirmed.state).toBe("confirmed");
    expect(confirmed.sentAt).toBe(claim.sentAt);
    const [row] = await database
      .select()
      .from(gameMilestoneClaims)
      .where(eq(gameMilestoneClaims.id, claim.id));
    expect(row?.broadcastAt?.toISOString()).toBe(claim.sentAt);
  });

  it("is delayed after more than an hour, but not at exactly an hour, and is still a claim that can complete", async () => {
    const { claim, userId } = await sentClaim();
    expect(claim.delayed).toBe(false);
    clock.now = new Date(clock.now.getTime() + minutes(60));
    expect((await refreshed(userId, claim.id)).delayed).toBe(false);
    clock.now = new Date(clock.now.getTime() + 1);
    const late = await refreshed(userId, claim.id);
    expect(late).toMatchObject({ delayed: true, failureReason: null });
    expect(late.state).toBe("pending");
    expect((await service.list(userId, late.gameId))[0]?.delayed).toBe(true);
  });

  it("is delayed when the indexer is more than two blocks behind, and judged by the time alone when the indexer cannot be asked", async () => {
    const { claim, userId } = await sentClaim();
    indexer.behind = 2;
    expect((await refreshed(userId, claim.id)).delayed).toBe(false);
    indexer.behind = 3;
    expect((await refreshed(userId, claim.id)).delayed).toBe(true);
    indexer.down = true;
    expect((await refreshed(userId, claim.id)).delayed).toBe(false);
    clock.now = new Date(clock.now.getTime() + minutes(61));
    expect((await refreshed(userId, claim.id)).delayed).toBe(true);
  });

  it("is never delayed while waiting for a signature or once complete", async () => {
    const userId = await player();
    const { claim, signed } = await startAndSign(userId);
    indexer.behind = 50;
    expect(claim.delayed).toBe(false);
    expect((await refreshed(userId, claim.id)).delayed).toBe(false);
    await service.submitSigned({ claimId: claim.id, signed, userId });
    indexer.behind = 0;
    network.controls.advance(chain, 3);
    expect((await refreshed(userId, claim.id)).state).toBe("confirmed");
    expect((await refreshed(userId, claim.id)).state).toBe("complete");
    indexer.behind = 50;
    clock.now = new Date(clock.now.getTime() + minutes(600));
    expect((await refreshed(userId, claim.id)).delayed).toBe(false);
  });
});

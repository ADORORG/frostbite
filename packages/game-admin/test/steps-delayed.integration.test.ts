import { gameAdminSteps } from "@frostbite/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  chain,
  clock,
  database,
  defineInput,
  indexer,
  network,
  registerDatabase,
  seedStaff,
  service,
  startAndSign,
} from "./support/fixture.ts";

registerDatabase();

const minutes = (count: number) => count * 60_000;

async function sentStep() {
  const staff = await seedStaff();
  const { signed, step } = await startAndSign(defineInput(staff));
  const sent = await service.submitSigned({
    signed,
    staffId: staff,
    stepId: step.id,
  });
  if (!sent.ok) throw new Error("not sent");
  return sent.step;
}

const refreshed = async (id: string) => {
  const result = await service.refresh(id);
  if (!result.ok) throw new Error("not refreshed");
  return result.step;
};

describe("a step that is taking long", () => {
  it("records when it was sent, once, and does not move that time when later news arrives", async () => {
    const before = await sentStep();
    expect(before.sentAt).toBe(clock.now.toISOString());
    clock.now = new Date(clock.now.getTime() + minutes(5));
    expect((await refreshed(before.id)).state).toBe("pending");
    network.controls.advance(chain, 3);
    clock.now = new Date(clock.now.getTime() + minutes(5));
    const confirmed = await refreshed(before.id);
    expect(confirmed.state).toBe("confirmed");
    expect(confirmed.sentAt).toBe(before.sentAt);
    const [row] = await database
      .select()
      .from(gameAdminSteps)
      .where(eq(gameAdminSteps.id, before.id));
    expect(row?.broadcastAt?.toISOString()).toBe(before.sentAt);
  });

  it("is not delayed at first, and is delayed once it has waited more than an hour, but not at exactly an hour", async () => {
    const step = await sentStep();
    expect(step.delayed).toBe(false);
    clock.now = new Date(clock.now.getTime() + minutes(60));
    expect((await refreshed(step.id)).delayed).toBe(false);
    clock.now = new Date(clock.now.getTime() + 1);
    const late = await refreshed(step.id);
    expect(late.delayed).toBe(true);
    expect(late.state).toBe("pending");
    expect(late.failureReason).toBeNull();
  });

  it("is delayed at once when the indexer is more than two blocks behind, and not when it is two behind", async () => {
    const step = await sentStep();
    indexer.behind = 2;
    expect((await refreshed(step.id)).delayed).toBe(false);
    indexer.behind = 3;
    expect((await refreshed(step.id)).delayed).toBe(true);
    expect((await service.list(step.gameId))[0]?.delayed).toBe(true);
    indexer.behind = 0;
    expect((await refreshed(step.id)).delayed).toBe(false);
  });

  it("judges by the time alone when the indexer cannot be asked, and is never delayed once it is done", async () => {
    const step = await sentStep();
    indexer.down = true;
    expect((await refreshed(step.id)).delayed).toBe(false);
    clock.now = new Date(clock.now.getTime() + minutes(61));
    expect((await refreshed(step.id)).delayed).toBe(true);
    indexer.down = false;
    network.controls.advance(chain, 3);
    expect((await refreshed(step.id)).state).toBe("confirmed");
    expect((await refreshed(step.id)).state).toBe("complete");
    indexer.behind = 50;
    expect((await refreshed(step.id)).delayed).toBe(false);
  });

  it("is not delayed while it waits for a signature, however long and however far behind the indexer is", async () => {
    const staff = await seedStaff();
    const { step } = await startAndSign(defineInput(staff));
    indexer.behind = 50;
    expect(step.sentAt).toBeNull();
    expect((await service.list(step.gameId))[0]?.delayed).toBe(false);
  });
});

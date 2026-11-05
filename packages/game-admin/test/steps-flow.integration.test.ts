import { eq } from "drizzle-orm";
import { gameAdminSteps } from "@frostbite/database";
import { describe, expect, it } from "vitest";

import {
  chain,
  clock,
  database,
  defineInput,
  network,
  pauseInput,
  registerDatabase,
  repository,
  seedStaff,
  service,
  startAndSign,
} from "./support/fixture.ts";

registerDatabase();

const rowOf = async (id: string) =>
  (
    await database
      .select()
      .from(gameAdminSteps)
      .where(eq(gameAdminSteps.id, id))
  )[0];

describe("defining a milestone from the start to complete", () => {
  it("builds the step, shows what it does, and records who built and who sent it", async () => {
    const builder = await seedStaff();
    const sender = await seedStaff();
    const { signed, step } = await startAndSign(defineInput(builder));
    expect(step).toMatchObject({
      createdBy: builder,
      milestoneId: "first-win",
      operation: "define-milestone",
      state: "awaiting_signature",
      submittedBy: null,
      transactionId: null,
    });
    expect(step.summary).toMatchObject({
      claimLimit: 1,
      drawing: { bytes: 6 },
      milestone: { id: "first-win" },
    });

    const sent = await service.submitSigned({
      signed,
      staffId: sender,
      stepId: step.id,
    });
    if (!sent.ok) throw new Error("not sent");
    expect(sent.step).toMatchObject({
      state: "broadcast_accepted",
      submittedBy: sender,
      toSign: null,
    });
    expect(await rowOf(step.id)).toMatchObject({
      createdBy: builder,
      submittedBy: sender,
    });

    const seen = async () => {
      const refreshed = await service.refresh(step.id);
      if (!refreshed.ok) throw new Error("not refreshed");
      return refreshed.step.state;
    };
    expect(await seen()).toBe("pending");
    network.controls.advance(chain, 3);
    expect(await seen()).toBe("confirmed");
    expect(await seen()).toBe("complete");
    expect(await seen()).toBe("complete");
  });

  it("returns the step in progress when asked again, and refuses to define a milestone twice", async () => {
    const staff = await seedStaff();
    const first = await startAndSign(defineInput(staff));
    const again = await service.start(defineInput(staff));
    expect(again).toMatchObject({ ok: true, resumed: true });
    if (!again.ok) throw new Error("no");
    expect(again.step.id).toBe(first.step.id);

    await service.submitSigned({
      signed: first.signed,
      staffId: staff,
      stepId: first.step.id,
    });
    network.controls.advance(chain, 3);
    await service.refresh(first.step.id);
    await service.refresh(first.step.id);
    expect(await service.start(defineInput(staff))).toEqual({
      code: "already-defined",
      ok: false,
    });
    // Another milestone is another step.
    expect(
      await service.start(
        defineInput(staff, {
          action: { milestoneId: "streak", operation: "define-milestone" },
        }),
      ),
    ).toMatchObject({ ok: true, resumed: false });
  });

  it("makes one step when two starts arrive together", async () => {
    const staff = await seedStaff();
    const results = await Promise.all([
      service.start(defineInput(staff)),
      service.start(defineInput(staff)),
    ]);
    const ids = results.map((result) => (result.ok ? result.step.id : ""));
    expect(new Set(ids).size).toBe(1);
    expect(await repository.list("arcade")).toHaveLength(1);
  });
});

describe("pausing and resuming", () => {
  it("is logged like any step and is one step in progress per game", async () => {
    const staff = await seedStaff();
    const paused = await startAndSign(pauseInput(staff));
    expect(paused.step).toMatchObject({
      milestoneId: null,
      operation: "set-claims-paused",
    });
    expect(paused.step.summary.paused).toBe(true);
    // A resume asked for while a pause is in flight returns the pause: one change at a time.
    const resumed = await service.start(pauseInput(staff, false));
    expect(resumed).toMatchObject({ ok: true, resumed: true });
    await service.submitSigned({
      signed: paused.signed,
      staffId: staff,
      stepId: paused.step.id,
    });
    network.controls.advance(chain, 3);
    await service.refresh(paused.step.id);
    await service.refresh(paused.step.id);
    // Once the pause is complete, a resume is a new step.
    const again = await service.start(pauseInput(staff, false));
    expect(again).toMatchObject({ ok: true, resumed: false });
    expect((await service.list("arcade")).map((step) => step.state)).toEqual([
      "complete",
      "awaiting_signature",
    ]);
  });

  it("lets a step that was never signed run out of time, and then be asked for again", async () => {
    const staff = await seedStaff();
    const { step } = await startAndSign(pauseInput(staff));
    clock.now = new Date(Date.parse(step.expiresAt) + 1);
    const refreshed = await service.refresh(step.id);
    expect(refreshed).toMatchObject({ ok: true, step: { state: "expired" } });
    expect(await service.start(pauseInput(staff))).toMatchObject({
      ok: true,
      resumed: false,
    });
  });

  it("starts a new step in place of one that was never signed and has run out of time", async () => {
    const staff = await seedStaff();
    const first = await service.start(pauseInput(staff));
    if (!first.ok) throw new Error("not started");
    clock.now = new Date(Date.parse(first.step.expiresAt) + 1);
    const second = await service.start(pauseInput(staff));
    if (!second.ok) throw new Error("not started");
    expect(second.resumed).toBe(false);
    expect(second.step.id).not.toBe(first.step.id);
    expect((await service.list("arcade")).map((step) => step.state)).toEqual([
      "expired",
      "awaiting_signature",
    ]);
  });
});

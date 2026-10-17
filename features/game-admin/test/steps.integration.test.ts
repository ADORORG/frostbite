import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { gameId } from "./support/fixtures.ts";
import {
  advance,
  createContract,
  operations,
  pause,
  registerHarness,
  seedStaff,
  sessionFor,
  sign,
  wallet,
} from "./support/harness.ts";

registerHarness();

const drawing =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1" width="8" height="8" fill="#ff0000"></rect></svg>';

// A game that has its contract, made the way the platform makes it.
async function withContract() {
  const ops = operations();
  const staff = await seedStaff("Maker");
  await createContract(ops, staff);
  return ops;
}

describe("administering a game through the operations", () => {
  it("goes from a pause to complete, one staff member building and another sending, both named in the log", async () => {
    const ada = await seedStaff("Ada");
    const grace = await seedStaff("Grace");
    const { list, refresh, start, submit } = await withContract();

    const started = await start.execute(pause, sessionFor(ada));
    if (!started.ok || started.value.status !== "started")
      throw new Error("not started");
    const { step } = started.value;
    expect(step).toMatchObject({
      createdBy: "Ada",
      state: "awaiting-signature",
      submittedBy: null,
    });
    if (step.toSign === null) throw new Error("nothing to sign");

    const sent = await submit.execute(
      { signed: sign(step.toSign), stepId: step.id },
      sessionFor(grace),
    );
    expect(sent).toMatchObject({
      ok: true,
      value: {
        status: "submitted",
        step: { state: "pending", submittedBy: "Grace", toSign: null },
      },
    });
    const sentStep =
      sent.ok && sent.value.status === "submitted" ? sent.value.step : null;
    expect(sentStep?.transactionId).toEqual(expect.any(String));
    const look = async () => {
      const seen = await refresh.execute({ stepId: step.id }, sessionFor(ada));
      return seen.ok && seen.value.status === "ok"
        ? seen.value.step.state
        : "refused";
    };
    // In no block yet, then three blocks deep, then the indexed state agrees, and then nothing more to do.
    const states = [await look()];
    advance(3);
    states.push(await look(), await look(), await look());
    expect(states).toEqual(["pending", "confirmed", "complete", "complete"]);

    const listed = await list.execute({ gameId }, sessionFor(grace));
    expect(listed).toMatchObject({
      ok: true,
      value: {
        contract: { address: expect.any(String), maxDrawingBytes: 4096 },
        drawingCeiling: 8192,
        templatesReady: true,
      },
    });
    const pausedStep =
      listed.ok &&
      listed.value.steps.find(
        ({ operation }) => operation === "set-claims-paused",
      );
    expect(pausedStep).toMatchObject({
      createdBy: "Ada",
      state: "complete",
      submittedBy: "Grace",
    });
  });

  it("defines a milestone with a drawing the sanitiser accepted, showing its size and hash, and refuses one it did not", async () => {
    const staff = await seedStaff();
    const { start } = await withContract();
    const defined = await start.execute(
      {
        action: {
          drawing,
          milestoneId: "first-win",
          operation: "define-milestone",
        },
        gameId,
        wallet,
      },
      sessionFor(staff),
    );
    if (!defined.ok || defined.value.status !== "started")
      throw new Error("not started");
    expect(defined.value.step.summary).toMatchObject({
      claimLimit: 1,
      drawing: { bytes: expect.any(Number) },
      milestoneId: "first-win",
    });
    const refused = await start.execute(
      {
        action: {
          drawing: "<script>alert(1)</script>",
          milestoneId: "streak",
          operation: "define-milestone",
        },
        gameId,
        wallet,
      },
      sessionFor(staff),
    );
    expect(refused).toMatchObject({
      ok: true,
      value: { reason: "bad-drawing", status: "refused" },
    });
  });

  it("answers that a game with no contract, an unknown game and another network's address cannot be administered", async () => {
    const staff = await seedStaff();
    const none = operations();
    expect(await none.start.execute(pause, sessionFor(staff))).toMatchObject({
      value: { reason: "unavailable", status: "refused" },
    });
    const { start } = await withContract();
    expect(
      await start.execute({ ...pause, gameId: "nope" }, sessionFor(staff)),
    ).toMatchObject({
      value: { reason: "not-administered", status: "refused" },
    });
    expect(
      await start.execute(
        { ...pause, wallet: "sim:two:a1b2c3fe" },
        sessionFor(staff),
      ),
    ).toMatchObject({
      value: { reason: "wrong-network", status: "refused" },
    });
  });

  it("refuses what was not what staff were shown, and a step that does not exist", async () => {
    const staff = await seedStaff();
    const { start, submit } = await withContract();
    const started = await start.execute(pause, sessionFor(staff));
    if (
      !started.ok ||
      started.value.status !== "started" ||
      started.value.step.toSign === null
    )
      throw new Error("not started");
    expect(
      await submit.execute(
        {
          signed: {
            ...started.value.step.toSign,
            payload: "not what was shown",
          },
          stepId: started.value.step.id,
        },
        sessionFor(staff),
      ),
    ).toMatchObject({
      value: { reason: "invalid-signature", status: "refused" },
    });
    expect(
      await submit.execute(
        { signed: sign(started.value.step.toSign), stepId: randomUUID() },
        sessionFor(staff),
      ),
    ).toMatchObject({ value: { reason: "not-found", status: "refused" } });
  });
});

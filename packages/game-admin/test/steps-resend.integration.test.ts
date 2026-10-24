import { describe, expect, it } from "vitest";

import { neverReceivedReason } from "../src/service.ts";

import {
  chain,
  clock,
  lostSend,
  network,
  pauseInput,
  registerDatabase,
  seedStaff,
  service,
  startAndSign,
} from "./support/fixture.ts";

registerDatabase();

const sendLost = async () => {
  const staff = await seedStaff();
  const { signed, step } = await startAndSign(pauseInput(staff));
  lostSend.next = true;
  const sent = await service.submitSigned({
    signed,
    staffId: staff,
    stepId: step.id,
  });
  if (!sent.ok) throw new Error("not sent");
  return { sent: sent.step, step };
};

describe("a step sent without the network being seen to hold it", () => {
  it("says so, and lists the id of the transaction to follow", async () => {
    const { sent } = await sendLost();
    expect(sent).toMatchObject({
      state: "broadcast_unknown",
      unconfirmedSend: true,
    });
    expect(sent.transactionId).not.toBeNull();
    expect(sent.transactions).toEqual([
      { id: sent.transactionId, role: "transaction" },
    ]);
  });

  it("sends the same signed transaction again when the network does not have it, and then follows it", async () => {
    const { sent, step } = await sendLost();
    const refreshed = await service.refresh(step.id);
    expect(refreshed).toMatchObject({
      ok: true,
      step: {
        state: "broadcast_accepted",
        transactionId: sent.transactionId,
        unconfirmedSend: false,
      },
    });
    network.controls.advance(chain, 3);
    expect(await service.refresh(step.id)).toMatchObject({
      ok: true,
      step: { transactionId: sent.transactionId },
    });
  });

  it("tells the network's refusal of the second send as a failure with its reason, not as waiting", async () => {
    const { step } = await sendLost();
    network.controls.failNext(chain, "rejected");
    expect(await service.refresh(step.id)).toMatchObject({
      ok: true,
      step: {
        failureReason: "rejected by the simulated network",
        state: "broadcast_rejected",
        transactionId: null,
        unconfirmedSend: false,
      },
    });
  });

  it("gives up on a step the network never has after the hour any wait is called delayed, as a failure that says so", async () => {
    lostSend.always = true;
    const { step } = await sendLost();
    clock.now = new Date(clock.now.getTime() + 30 * 60_000);
    expect(await service.refresh(step.id)).toMatchObject({
      ok: true,
      step: { state: "broadcast_unknown", unconfirmedSend: true },
    });
    clock.now = new Date(clock.now.getTime() + 31 * 60_000);
    expect(await service.refresh(step.id)).toMatchObject({
      ok: true,
      step: {
        failureReason: neverReceivedReason,
        state: "broadcast_rejected",
        transactionId: null,
        unconfirmedSend: false,
      },
    });
  });

  it("does not send again when the network already has it", async () => {
    const staff = await seedStaff();
    network.controls.failNext(chain, "ambiguous");
    const { signed, step } = await startAndSign(pauseInput(staff));
    const sent = await service.submitSigned({
      signed,
      staffId: staff,
      stepId: step.id,
    });
    expect(sent).toMatchObject({ step: { state: "broadcast_unknown" } });
    // A refusal forced for the next send would show a second send: the step must not turn into a failure.
    network.controls.failNext(chain, "rejected");
    expect(await service.refresh(step.id)).toMatchObject({
      ok: true,
      step: { state: "pending" },
    });
  });

  it("leaves a step that is not signed without transactions to list", async () => {
    const staff = await seedStaff();
    const { step } = await startAndSign(pauseInput(staff));
    expect(step.transactions).toEqual([]);
  });
});

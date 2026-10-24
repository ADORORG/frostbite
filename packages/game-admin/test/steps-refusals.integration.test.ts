import { describe, expect, it } from "vitest";

import {
  administeredGame,
  broadcastGate,
  chain,
  chainAvailable,
  chainFailure,
  clock,
  defineInput,
  game,
  network,
  pauseInput,
  registerDatabase,
  seedStaff,
  service,
  signSimulated,
  startAndSign,
  wallet,
} from "./support/fixture.ts";

registerDatabase();

describe("a step that cannot start", () => {
  it("says why: unknown game or milestone, no contract, no chain, wrong network", async () => {
    const staff = await seedStaff();
    expect(await service.start(defineInput(staff, { gameId: "nope" }))).toEqual(
      {
        code: "not-administered",
        ok: false,
      },
    );
    expect(
      await service.start(
        defineInput(staff, {
          action: { milestoneId: "missing", operation: "define-milestone" },
        }),
      ),
    ).toEqual({ code: "not-administered", ok: false });
    game.current = { ...administeredGame(), contract: null };
    expect(await service.start(pauseInput(staff))).toEqual({
      code: "unavailable",
      ok: false,
    });
    game.current = administeredGame();
    chainAvailable.value = false;
    expect(await service.start(pauseInput(staff))).toEqual({
      code: "unavailable",
      ok: false,
    });
    chainAvailable.value = true;
    expect(
      await service.start({ ...pauseInput(staff), wallet: "sim:two:a1b2c3" }),
    ).toEqual({ code: "wrong-chain", ok: false });
  });

  it("refuses a drawing the sanitiser refuses, and tells the reason", async () => {
    const staff = await seedStaff();
    expect(
      await service.start(
        defineInput(staff, {
          action: {
            drawing: "<script/>",
            milestoneId: "first-win",
            operation: "define-milestone",
          },
        }),
      ),
    ).toEqual({ code: "bad-drawing", ok: false, reason: "not a drawing" });
  });

  it("passes on why the chain could not build it", async () => {
    const staff = await seedStaff();
    chainFailure.build = true;
    expect(await service.start(pauseInput(staff))).toEqual({
      code: "could-not-build",
      ok: false,
      reason: "the node is down",
    });
  });

  it("refuses, in words and before storing anything, a step larger than the platform keeps", async () => {
    const staff = await seedStaff();
    chainFailure.oversize = true;
    const refused = await service.start(pauseInput(staff));
    if (refused.ok || refused.code !== "could-not-build")
      throw new Error("The oversized step was not refused as unbuildable.");
    expect(refused.reason).toMatch(
      /^The step's transaction is \d+ characters, more than the \d+ the platform keeps, which is the most Bitcoin nodes relay\.$/u,
    );
    expect(await service.list("arcade")).toEqual([]);
  });
});

describe("sending a signed step", () => {
  it("refuses what was not what staff were shown, and a step that is not theirs to sign", async () => {
    const staff = await seedStaff();
    const { signed, step } = await startAndSign(pauseInput(staff));
    expect(
      await service.submitSigned({
        signed: { ...signed, payload: `x${signed.payload}` },
        staffId: staff,
        stepId: step.id,
      }),
    ).toMatchObject({ code: "invalid-signature", ok: false });
    expect(
      await service.submitSigned({
        signed,
        staffId: staff,
        stepId: crypto.randomUUID(),
      }),
    ).toEqual({ code: "not-found", ok: false });
  });

  it("sends once: the same signed step again changes nothing, another is refused", async () => {
    const staff = await seedStaff();
    const { signed, step } = await startAndSign(pauseInput(staff));
    const first = await service.submitSigned({
      signed,
      staffId: staff,
      stepId: step.id,
    });
    const again = await service.submitSigned({
      signed,
      staffId: staff,
      stepId: step.id,
    });
    expect(again).toEqual(first);
    expect(
      await service.submitSigned({
        signed: { ...signed, payload: `${signed.payload}.other` },
        staffId: staff,
        stepId: step.id,
      }),
    ).toEqual({ code: "not-awaiting-signature", ok: false });
  });

  it("refuses to send after the step has expired, and records that it expired", async () => {
    const staff = await seedStaff();
    const { signed, step } = await startAndSign(pauseInput(staff));
    clock.now = new Date(Date.parse(step.expiresAt) + 1);
    expect(
      await service.submitSigned({ signed, staffId: staff, stepId: step.id }),
    ).toEqual({
      code: "expired",
      ok: false,
    });
    expect(
      (await service.refresh(step.id)).ok &&
        (await service.list("arcade"))[0]?.state,
    ).toBe("expired");
  });

  it("answers chain-unavailable when the adapter is gone, leaving the step awaiting its signature", async () => {
    const staff = await seedStaff();
    const { signed, step } = await startAndSign(pauseInput(staff));
    chainAvailable.value = false;
    expect(
      await service.submitSigned({ signed, staffId: staff, stepId: step.id }),
    ).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    expect(await service.refresh(step.id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    chainAvailable.value = true;
    expect((await service.refresh(step.id)).ok).toBe(true);
    expect(await service.refresh(crypto.randomUUID())).toEqual({
      code: "not-found",
      ok: false,
    });
  });

  it("records a refusal by the network, and a revert, as failures with their reasons", async () => {
    const staff = await seedStaff();
    network.controls.failNext(chain, "rejected");
    const first = await startAndSign(pauseInput(staff));
    const sent = await service.submitSigned({
      signed: first.signed,
      staffId: staff,
      stepId: first.step.id,
    });
    expect(sent).toMatchObject({
      ok: true,
      step: { state: "broadcast_rejected" },
    });
    const second = await startAndSign(pauseInput(staff));
    const accepted = await service.submitSigned({
      signed: second.signed,
      staffId: staff,
      stepId: second.step.id,
    });
    if (!accepted.ok || accepted.step.transactionId === null)
      throw new Error("not sent");
    network.controls.advance(chain, 3);
    network.controls.revert({ chain, id: accepted.step.transactionId });
    const seen = await service.refresh(second.step.id);
    expect(seen).toMatchObject({
      ok: true,
      step: {
        failureReason: "reverted by the network",
        state: "indexed_failure",
      },
    });
  });

  it("keeps a step whose network could not be asked, and sends it on the next refresh", async () => {
    const staff = await seedStaff();
    network.controls.failNext(chain, "unavailable");
    const { signed, step } = await startAndSign(pauseInput(staff));
    expect(
      await service.submitSigned({ signed, staffId: staff, stepId: step.id }),
    ).toMatchObject({
      ok: true,
      step: { state: "signed" },
    });
    expect(await service.refresh(step.id)).toMatchObject({
      ok: true,
      step: { state: "broadcast_accepted" },
    });
  });

  it("does not let two sends of one step both reach the network", async () => {
    const staff = await seedStaff();
    const { signed, step } = await startAndSign(pauseInput(staff));
    broadcastGate.enabled = true;
    const both = Promise.all([
      service.submitSigned({ signed, staffId: staff, stepId: step.id }),
      service.submitSigned({ signed, staffId: staff, stepId: step.id }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    broadcastGate.held.forEach((release) => release());
    broadcastGate.enabled = false;
    const results = await both;
    expect(results.every((result) => result.ok)).toBe(true);
    expect(signSimulated).toBeTypeOf("function");
    expect(wallet.chain).toBe(chain);
  });
});

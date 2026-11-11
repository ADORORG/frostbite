import { describe, expect, it } from "vitest";
import type { TransactionIntent } from "@frostbite/shared/chain";

import { signSimulated } from "../src/simulated-chain/transaction.ts";
import { funding, simulatedPorts } from "./support/chains.ts";

// Staff operations built through the simulated adapter's own ports, as a service would.
type Ports = ReturnType<typeof simulatedPorts>;
type Make = (ports: Ports) => TransactionIntent;

async function built(make: Make) {
  const ports = simulatedPorts();
  const unsigned = await ports.need("builder").build(make(ports), funding);
  return { ...ports, unsigned };
}

const base = (ports: Ports) => ({
  chain: ports.claimIntent.chain,
  sender: ports.claimIntent.sender,
});

describe("administration on the simulated chain", () => {
  it("shows a milestone definition as its limit, contract and the drawing's size and hash", async () => {
    const { contract, need, unsigned } = await built((ports) => ({
      ...base(ports),
      claimLimit: 3,
      contract: ports.contract,
      drawing: "<svg/>",
      milestoneId: "first-frost",
      operation: "define-milestone",
    }));
    expect(unsigned.summary).toMatchObject({
      claimLimit: 3,
      contract,
      drawing: { bytes: 6 },
      milestone: { contract, id: "first-frost" },
      operation: "define-milestone",
    });
    expect(unsigned.summary.drawing?.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(
      need("builder").verifySigned(unsigned, signSimulated(unsigned)),
    ).toEqual({ ok: true });
  });

  it("builds a definition without a drawing, shows a pause and a template, and verifies each", async () => {
    const makers: Make[] = [
      (ports) => ({
        ...base(ports),
        claimLimit: 1,
        contract: ports.contract,
        milestoneId: "plain",
        operation: "define-milestone",
      }),
      (ports) => ({
        ...base(ports),
        contract: ports.contract,
        operation: "set-claims-paused",
        paused: true,
      }),
      (ports) => ({
        ...base(ports),
        operation: "publish-template",
        templateAt: { ...ports.contract, id: "at-1" },
        templateId: "game-rewards",
        templateVersion: "1.0.0",
      }),
      (ports) => ({
        ...base(ports),
        collectibleAt: { ...ports.contract, id: "at-2" },
        maxDrawingBytes: 2048,
        operation: "deploy",
        templateAt: { ...ports.contract, id: "at-1" },
        templateId: "game-rewards",
        templateVersion: "1.0.0",
      }),
    ];
    for (const make of makers) {
      const { need, unsigned } = await built(make);
      expect(
        need("builder").verifySigned(unsigned, signSimulated(unsigned)),
      ).toEqual({ ok: true });
    }
  });

  it("refuses a summary that says something else than the payload does", async () => {
    const { need, unsigned } = await built((ports) => ({
      ...base(ports),
      contract: ports.contract,
      operation: "set-claims-paused",
      paused: true,
    }));
    const lying = {
      ...unsigned,
      summary: { ...unsigned.summary, paused: false },
    };
    expect(need("builder").verifySigned(lying, signSimulated(lying))).toEqual({
      ok: false,
      reason: "summary-mismatch",
    });
  });

  it("shows where a template is published and what the new contract is created with, and refuses a summary that changes either", async () => {
    const { need, unsigned } = await built((ports) => ({
      ...base(ports),
      collectibleAt: { ...ports.contract, id: "at-2" },
      maxDrawingBytes: 2048,
      operation: "deploy",
      templateAt: { ...ports.contract, id: "at-1" },
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    }));
    expect(unsigned.summary.template?.at?.id).toBe("at-1");
    expect(unsigned.summary.collectibleAt?.id).toBe("at-2");
    expect(unsigned.summary.maxDrawingBytes).toBe(2048);
    const { collectibleAt, template } = unsigned.summary;
    if (collectibleAt === undefined || template?.at === undefined)
      throw new Error("the summary names no addresses");
    const lies = (change: Partial<typeof unsigned.summary>) => {
      const lying = {
        ...unsigned,
        summary: { ...unsigned.summary, ...change },
      };
      return need("builder").verifySigned(lying, signSimulated(lying));
    };
    const mismatch = { ok: false, reason: "summary-mismatch" };
    expect(lies({ maxDrawingBytes: 1 })).toEqual(mismatch);
    expect(lies({ collectibleAt: { ...collectibleAt, id: "x" } })).toEqual(
      mismatch,
    );
    expect(
      lies({ template: { ...template, at: { ...template.at, id: "x" } } }),
    ).toEqual(mismatch);
  });

  it("names the contract a deployment created once it is confirmed, and no other step does", async () => {
    const ports = simulatedPorts();
    const send = async (intent: TransactionIntent) => {
      const unsigned = await ports.need("builder").build(intent, funding);
      const outcome = await ports
        .need("broadcaster")
        .broadcast(signSimulated(unsigned));
      if (outcome.kind !== "accepted") throw new Error("not accepted");
      return outcome.ref;
    };
    const deploy = await send({
      ...base(ports),
      collectibleAt: { ...ports.contract, id: "at-2" },
      maxDrawingBytes: 2048,
      operation: "deploy",
      templateAt: { ...ports.contract, id: "at-1" },
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    });
    const pause = await send({
      ...base(ports),
      contract: ports.contract,
      operation: "set-claims-paused",
      paused: true,
    });
    const observer = ports.need("observer");
    expect((await observer.observe(deploy)).created).toBeUndefined();
    ports.controls.advance(deploy.chain, 10);
    const made = await observer.observe(deploy);
    expect(made.status).toBe("confirmed");
    expect(made.created).toHaveLength(1);
    expect(made.created?.[0]).toMatch(/^sim-game-\d+$/u);
    expect((await observer.observe(pause)).created).toBeUndefined();
  });
  it("reports the drawing a confirmed definition carried, and none for a definition without one", async () => {
    const ports = simulatedPorts();
    const define = async (milestoneId: string, drawing?: string) => {
      const unsigned = await ports.need("builder").build(
        {
          ...base(ports),
          claimLimit: 1,
          contract: ports.contract,
          drawing,
          milestoneId,
          operation: "define-milestone",
        },
        funding,
      );
      await ports.need("broadcaster").broadcast(signSimulated(unsigned));
      return unsigned.summary.drawing;
    };
    const drawn = await define("drawn", "<svg/>");
    await define("plain");
    const rewards = ports.need("rewards");
    expect(await rewards.drawing(ports.contract, "drawn")).toBeNull();
    ports.controls.advance(ports.contract.chain, 10);
    expect(await rewards.drawing(ports.contract, "drawn")).toEqual(drawn);
    expect(await rewards.drawing(ports.contract, "plain")).toBeNull();
  });
});

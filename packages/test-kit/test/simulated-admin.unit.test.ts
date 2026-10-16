import { describe, expect, it } from "vitest";
import type { TransactionIntent } from "@ador/shared/chain";

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
        templateId: "game-rewards",
        templateVersion: "1.0.0",
      }),
      (ports) => ({
        ...base(ports),
        operation: "deploy",
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
});

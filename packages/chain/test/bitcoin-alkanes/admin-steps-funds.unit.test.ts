import { describe, expect, it } from "vitest";

import { defineMilestoneCall } from "../../src/bitcoin-alkanes/admin/calls.ts";
import { planEnvelopeStep } from "../../src/bitcoin-alkanes/admin/envelope-step.ts";
import { planPlainStep } from "../../src/bitcoin-alkanes/admin/plain-step.ts";
import { StepRefusedError } from "../../src/bitcoin-alkanes/admin/types.ts";
import { idA, utxo } from "../support/claims.ts";
import { fixedKey, fundingFor, tokenOutput } from "../support/admin.ts";

const game = { block: 2n, tx: 1n };
const call = defineMilestoneCall(game, 77n, 3n);
const drawing = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
);

// The wallet's only money is 5,000,000 sats that are still waiting for their first confirmation.
function waitingFunding() {
  const funding = fundingFor(tokenOutput);
  return {
    ...funding,
    funder: {
      ...funding.funder,
      utxos: [{ ...utxo(idA, 0, 5_000_000n), confirmed: false }],
    },
  };
}

describe("a step the wallet cannot pay for yet", () => {
  it("is refused as insufficient funds, saying how much is only waiting to confirm (plain step)", () => {
    let refusal: unknown;
    try {
      planPlainStep(call, waitingFunding());
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(StepRefusedError);
    expect(refusal).toMatchObject({ reason: "insufficient-funds" });
    expect(refusal instanceof Error ? refusal.message : "").toMatch(
      /confirmed balance cannot pay.*5000000 sats in the wallet are still waiting/u,
    );
  });

  it("says the same for an envelope step", () => {
    expect(() =>
      planEnvelopeStep(call, drawing, waitingFunding(), fixedKey()),
    ).toThrow(/5000000 sats in the wallet are still waiting/u);
  });
});

// The numbers in a refusal for want of funds: what the step needs at the rate it was priced at, and what the wallet holds.
function needs(message: string): bigint {
  const found =
    /it needs about (\d+) sats at 2 sat\/vB, but the wallet holds 100 confirmed\./u.exec(
      message,
    );
  if (found?.[1] === undefined) throw new Error(`No amounts in: ${message}`);
  return BigInt(found[1]);
}

describe("a step refused for want of funds says how much is missing", () => {
  const poor = () => fundingFor(null, 100n);
  const message = (run: () => unknown): string => {
    try {
      run();
    } catch (error) {
      if (error instanceof Error) return error.message;
    }
    throw new Error("The step was not refused.");
  };

  it("gives the cost at its fee rate and the confirmed balance (plain step)", () => {
    // At least the output's dust limit, plus a fee for a transaction with an input, outputs and a call.
    expect(needs(message(() => planPlainStep(call, poor())))).toBeGreaterThan(
      546n + 100n,
    );
  });

  it("gives them for an envelope step too, which costs more because its reveal carries the data", () => {
    const plain = needs(message(() => planPlainStep(call, poor())));
    const envelope = needs(
      message(() => planEnvelopeStep(call, drawing, poor(), fixedKey())),
    );
    expect(envelope).toBeGreaterThan(plain);
  });
});

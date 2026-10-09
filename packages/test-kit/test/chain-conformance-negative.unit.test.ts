import type { Observation, TransactionIntent } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import type { ChainAdapter } from "@ador/chain/adapter";

import {
  checkAddressCodec,
  checkBroadcastAndObservation,
  checkCapabilityConsistency,
  checkReader,
  checkSigningVerification,
  checkSummaryFidelity,
} from "../src/chain-conformance-checks.ts";
import { fixedNow, one, simulated } from "./support/chains.ts";

// The suite must be able to fail. Each case breaks one rule in an otherwise correct adapter and
// expects the matching check to refuse it.
function broken(
  adapter: ChainAdapter,
  ports: Partial<ChainAdapter["ports"]>,
): ChainAdapter {
  return { ...adapter, ports: { ...adapter.ports, ...ports } };
}

function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("fixture adapter lacks a port");
  return value;
}

describe("the conformance suite refuses a broken adapter", () => {
  it("passes the correct simulated adapter through every check", async () => {
    const { adapter, fixtures } = simulated();
    checkAddressCodec(adapter, fixtures);
    await checkSummaryFidelity(adapter, fixtures);
    await checkSigningVerification(adapter, fixtures);
    await checkBroadcastAndObservation(adapter, fixtures);
    await checkReader(adapter, fixtures);
  });

  it("refuses an adapter that declares a port it does not provide, or provides one it does not declare", () => {
    const { adapter } = simulated();
    expect(() => checkCapabilityConsistency(adapter)).not.toThrow();
    const withoutReader = { ...adapter.ports, reader: undefined };
    expect(() =>
      checkCapabilityConsistency({ ...adapter, ports: withoutReader }),
    ).toThrow(/reader is declared and provided inconsistently/u);
    const undeclared = new Set(adapter.capabilities);
    undeclared.delete("chain:read");
    expect(() =>
      checkCapabilityConsistency({ ...adapter, capabilities: undeclared }),
    ).toThrow(/reader is declared and provided inconsistently/u);
  });

  it("holds a mint and a deploy to the same summary rules as a transfer", async () => {
    const { adapter, fixtures, sender } = simulated();
    const { transaction } = fixtures;
    if (!transaction)
      throw new Error("the simulated fixtures cover transactions");
    const intents: readonly TransactionIntent[] = [
      {
        chain: one,
        contract: { chain: one, family: adapter.family, id: "collection" },
        operation: "mint",
        quantity: 2n,
        sender,
      },
      {
        chain: one,
        operation: "deploy",
        sender,
        templateId: "collection",
        templateVersion: "1.0.0",
      },
    ];
    for (const intent of intents) {
      const covered = { ...fixtures, transaction: { ...transaction, intent } };
      await checkSigningVerification(adapter, covered);
    }
  });

  it("refuses a codec that repairs input instead of rejecting it", () => {
    const { adapter, fixtures } = simulated();
    const codec = need(adapter.ports.addressCodec);
    const lenient = broken(adapter, {
      addressCodec: {
        parse: (chain, text) => codec.parse(chain, text.trim().toLowerCase()),
      },
    });
    expect(() => checkAddressCodec(lenient, fixtures)).toThrow(
      /must be refused with InvalidAddressError/u,
    );
  });

  it("refuses a codec that accepts another chain's address", () => {
    const { adapter, fixtures } = simulated();
    const accepting = broken(adapter, {
      addressCodec: { parse: (chain, text) => ({ chain, value: text }) },
    });
    expect(() => checkAddressCodec(accepting, fixtures)).toThrow(
      /must be refused with InvalidAddressError/u,
    );
  });

  it("refuses an adapter that claims a chain it cannot serve", () => {
    const { adapter, fixtures } = simulated();
    expect(() =>
      checkAddressCodec({ ...adapter, supports: () => true }, fixtures),
    ).toThrow(/does not claim a chain it cannot serve/u);
  });

  it("refuses a summary that does not match what is built", async () => {
    const { adapter, fixtures } = simulated();
    const builder = need(adapter.ports.builder);
    const lying = broken(adapter, {
      builder: {
        ...builder,
        build: async (intent, funding) => {
          const built = await builder.build(intent, funding);
          const amount = built.summary.amount;
          return {
            ...built,
            summary: {
              ...built.summary,
              amount: amount && { ...amount, baseUnits: amount.baseUnits + 1n },
            },
          };
        },
      },
    });
    await expect(checkSummaryFidelity(lying, fixtures)).rejects.toThrow(
      /amount shown is the amount built/u,
    );
  });

  it("refuses a summary that has already expired", async () => {
    const { adapter, fixtures } = simulated();
    const builder = need(adapter.ports.builder);
    const stale = broken(adapter, {
      builder: {
        ...builder,
        build: async (intent, funding) => {
          const built = await builder.build(intent, funding);
          return {
            ...built,
            summary: {
              ...built.summary,
              expiresAt: new Date(fixedNow.getTime() - 1).toISOString(),
            },
          };
        },
      },
    });
    await expect(checkSummaryFidelity(stale, fixtures)).rejects.toThrow(
      /has not expired/u,
    );
  });

  it("refuses a verifier that approves a tampered transaction", async () => {
    const { adapter, fixtures } = simulated();
    const builder = need(adapter.ports.builder);
    const approving = broken(adapter, {
      builder: { ...builder, verifySigned: () => ({ ok: true }) },
    });
    await expect(checkSigningVerification(approving, fixtures)).rejects.toThrow(
      /must not verify/u,
    );
  });

  it("refuses a broadcaster that yields a new transaction id on every attempt", async () => {
    const { adapter, fixtures } = simulated();
    let counter = 0;
    const fresh = broken(adapter, {
      broadcaster: {
        broadcast: () => {
          counter += 1;
          return Promise.resolve({
            kind: "accepted",
            ref: { chain: fixtures.chain, id: `tx-${counter}` },
          });
        },
      },
    });
    await expect(checkBroadcastAndObservation(fresh, fixtures)).rejects.toThrow(
      /two transaction ids/u,
    );
  });

  it("refuses a broadcaster that never reaches the network, so observation cannot be skipped", async () => {
    const { adapter, fixtures } = simulated();
    const offline = broken(adapter, {
      broadcaster: {
        broadcast: () => Promise.resolve({ kind: "unavailable" }),
      },
    });
    await expect(
      checkBroadcastAndObservation(offline, fixtures),
    ).rejects.toThrow(/must be accepted or ambiguous/u);
  });

  it("refuses a broadcaster that rejects the fixture transaction", async () => {
    const { adapter, fixtures } = simulated();
    const rejecting = broken(adapter, {
      broadcaster: {
        broadcast: () => Promise.resolve({ kind: "rejected", reason: "no" }),
      },
    });
    await expect(
      checkBroadcastAndObservation(rejecting, fixtures),
    ).rejects.toThrow(/must be accepted or ambiguous/u);
  });

  it("refuses an observer whose evidence changes between identical reads", async () => {
    const { adapter, fixtures } = simulated();
    const observer = need(adapter.ports.observer);
    let reads = 0;
    const drifting = broken(adapter, {
      observer: {
        observe: async (ref): Promise<Observation> => {
          reads += 1;
          return { ...(await observer.observe(ref)), confirmations: reads };
        },
      },
    });
    await expect(
      checkBroadcastAndObservation(drifting, fixtures),
    ).rejects.toThrow(/equivalent evidence/u);
  });

  it("refuses a reader that returns another chain's balances or head", async () => {
    const { adapter, fixtures } = simulated();
    const reader = need(adapter.ports.reader);
    const wrongHead = broken(adapter, {
      reader: {
        ...reader,
        head: async () => ({
          ...(await reader.head(fixtures.chain)),
          chain: fixtures.unservedChain,
        }),
      },
    });
    await expect(checkReader(wrongHead, fixtures)).rejects.toThrow(
      /head is on the requested chain/u,
    );
    const wrongBalances = broken(adapter, {
      reader: {
        ...reader,
        balances: () =>
          Promise.resolve([
            {
              asset: {
                chain: fixtures.unservedChain,
                id: "sim",
                kind: "native",
              },
              baseUnits: 1n,
            },
          ]),
      },
    });
    await expect(checkReader(wrongBalances, fixtures)).rejects.toThrow(
      /balances stay on the owner's chain/u,
    );
  });

  it("refuses fixtures that do not cover a declared builder, and a declared port that is missing", async () => {
    const { adapter, fixtures } = simulated();
    const withoutTransaction = { ...fixtures, transaction: undefined };
    await expect(
      checkSummaryFidelity(adapter, withoutTransaction),
    ).rejects.toThrow(/must cover a declared builder/u);
    const withoutBuilder = { ...adapter.ports, builder: undefined };
    await expect(
      checkSummaryFidelity({ ...adapter, ports: withoutBuilder }, fixtures),
    ).rejects.toThrow(/declares builder/u);
  });
});

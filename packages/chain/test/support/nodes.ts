import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";

// A node on which every call fails unless the test supplies it, so a test says exactly which calls it expects.
export function fakeNode(overrides: Partial<AlkanesNode> = {}): AlkanesNode {
  const unexpected = (name: string) => (): Promise<never> =>
    Promise.reject(new Error(`${name} was not expected`));
  return {
    broadcast: unexpected("broadcast"),
    bytecode: unexpected("bytecode"),
    feeRate: unexpected("feeRate"),
    indexedHeight: unexpected("indexedHeight"),
    tip: unexpected("tip"),
    trace: unexpected("trace"),
    transaction: unexpected("transaction"),
    utxos: unexpected("utxos"),
    view: unexpected("view"),
    ...overrides,
  };
}

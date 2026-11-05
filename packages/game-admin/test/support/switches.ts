import type { TransactionIntent } from "@frostbite/shared/chain";

// The switches a test flips to make the simulated chain and its node misbehave. The fixture reads them on every call and puts them back
// before each test.
export const chainAvailable = { value: true };
// Makes the chain fail to build (with an error, or with something that is not one), or build a transaction larger than the platform keeps.
export const chainFailure: { build: boolean | "opaque"; oversize: boolean } = {
  build: false,
  oversize: false,
};
// The intents the chain was asked to build, oldest first.
export const builtIntents: TransactionIntent[] = [];
// Makes the chain find no free address for a template.
export const placement = { exhausted: false };
// Makes the chain say nothing of what a step created.
export const hideCreated = { value: false };
// What the chain says of a contract staff enter by hand: whether code is there, its hash, or that the node cannot be asked.
export const inspected: {
  codeHash: string | null;
  down: boolean;
  exists: boolean;
} = { codeHash: null, down: false, exists: false };
// How far behind the tip the chain's indexer is, or that the node cannot be asked.
export const indexer = { behind: 0, down: false };
// Makes the next broadcast end as the real adapter does when its node cannot be reached: ambiguous, never received.
export const lostSend = { always: false, next: false };
// Held broadcasts, so two steps on one transaction can be made to overlap.
export const broadcastGate: { enabled: boolean; held: (() => void)[] } = {
  enabled: false,
  held: [],
};

import type {
  CollectiblePreview,
  TransactionIntent,
} from "@frostbite/shared/chain";

// What a test makes the chain and the claims service do on purpose, as state it sets and the fixture resets before each test.

// While `on`, the indexer is behind: it shows one claim fewer than the network has confirmed.
export const indexerLag = { on: false };
// How far behind the chain's tip its indexer reads, or that the node cannot be asked.
export const indexer = { behind: 0, down: false };
// What the chain does wrong on purpose.
// Held broadcasts, released by a test one at a time, so two steps on one claim can be made to overlap.
export const broadcastGate: { enabled: boolean; held: (() => void)[] } = {
  enabled: false,
  held: [],
};
// The intents the chain was asked to build, oldest first.
export const builtIntents: TransactionIntent[] = [];
export const chainFailure: {
  broadcast: boolean;
  // What building throws: any error (the node is down by default), or none.
  build: Error | boolean;
  observe: boolean;
  // Why the contract would refuse the claim, in its words, or none.
  simulate: string | false;
} = {
  broadcast: false,
  build: false,
  observe: false,
  simulate: false,
};
// What the service was told stopped a claim from starting, oldest first.
// What the chain says of the item a claim minted: the item the transaction created once it is included (the simulated chain mints
// none), and what it serves for it. Reset before each test.
export const collectible: {
  created: string | null;
  preview: (() => Promise<CollectiblePreview | null>) | null;
} = { created: null, preview: null };
export const item = "sim-item-1";
export const drawing = new TextEncoder().encode("<svg></svg>");

export const reported: { error: unknown; step: string }[] = [];

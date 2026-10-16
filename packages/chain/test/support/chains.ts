import {
  chainFamilyIdSchema,
  chainRefSchema,
  type ChainConfig,
} from "@ador/shared/chain";

import type { ChainAdapter } from "../../src/adapter.ts";
import {
  InvalidAddressError,
  type AddressCodec,
  type Broadcaster,
  type ChainObserver,
} from "../../src/ports.ts";

// Chain identifiers invented for tests only; production values come from validated configuration.
export const alpha = chainRefSchema.parse("test:alpha");
export const beta = chainRefSchema.parse("test:beta");
export const gamma = chainRefSchema.parse("other:gamma");
export const familyA = chainFamilyIdSchema.parse("family-a");
export const familyB = chainFamilyIdSchema.parse("family-b");

const policy = {
  deploy: { kind: "confirmations", required: 3 },
  mint: { kind: "confirmations", required: 2 },
  "mint-milestone": { kind: "confirmations", required: 2 },
  "publish-template": { kind: "confirmations", required: 3 },
  "define-milestone": { kind: "confirmations", required: 3 },
  "set-claims-paused": { kind: "confirmations", required: 1 },
  transfer: { kind: "finalized" },
} as const;

export function chainConfig(overrides: Partial<ChainConfig> = {}): ChainConfig {
  return {
    chainId: alpha,
    confirmations: policy,
    displayName: "Alpha",
    enabled: true,
    family: familyA,
    releaseGate: "closed",
    role: "public-beta",
    ...overrides,
  };
}

export const echoCodec: AddressCodec = {
  parse: (chain, text) => {
    if (text.length === 0) throw new InvalidAddressError("empty");
    return { chain, value: text };
  },
};

export const silentBroadcaster: Broadcaster = {
  broadcast: () => Promise.resolve({ kind: "unavailable" }),
};

export const silentObserver: ChainObserver = {
  observe: () => Promise.reject(new Error("not used")),
};

export function fakeAdapter(
  overrides: Partial<ChainAdapter> = {},
): ChainAdapter {
  return {
    capabilities: new Set(["address:codec"]),
    family: familyA,
    ports: { addressCodec: echoCodec },
    supports: (chain) => chain === alpha || chain === beta,
    testOnly: false,
    version: "1.0.0",
    ...overrides,
  };
}

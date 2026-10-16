import type { ChainFamilyId, ChainRef } from "@ador/shared/chain";

import type { ChainPorts } from "./ports.ts";

// The capability each port stands for. An adapter must declare exactly the capabilities of the
// ports it provides, so a missing or undeclared port fails at boot rather than at mint time.
export const portCapabilities = {
  addressCodec: "address:codec",
  broadcaster: "transaction:broadcast",
  builder: "transaction:build",
  contracts: "contract:gateway",
  observer: "transaction:observe",
  reader: "chain:read",
  rewards: "rewards:read",
} as const satisfies Readonly<Record<keyof ChainPorts, string>>;

export type PortName = keyof ChainPorts;

// Listed explicitly so the registry iterates a typed list; the `satisfies` clause and a unit test
// keep it equal to the keys of `portCapabilities`.
export const portNames = [
  "addressCodec",
  "broadcaster",
  "builder",
  "contracts",
  "observer",
  "reader",
  "rewards",
] as const satisfies readonly PortName[];

// Port capabilities are listed above; families add their own (for example `native-payment` or
// `allowlist-proof:merkle`). The registry validates every declared and required name with
// `chainCapabilitySchema` at boot.
export type ChainCapability = string;

export interface ChainAdapter {
  readonly capabilities: ReadonlySet<ChainCapability>;
  readonly family: ChainFamilyId;
  readonly ports: Readonly<Partial<ChainPorts>>;
  supports(chain: ChainRef): boolean;
  // A test-only adapter (the simulated family) is refused for any chain whose role is not `test`.
  readonly testOnly: boolean;
  readonly version: string;
}

import { describe, it } from "vitest";

import { portCapabilities, type ChainAdapter } from "@ador/chain/adapter";

import {
  checkAddressCodec,
  checkBroadcastAndObservation,
  checkCapabilityConsistency,
  checkReader,
  checkSigningVerification,
  checkSummaryFidelity,
  type ChainConformanceFixtures,
} from "./chain-conformance-checks.ts";

export type { ChainConformanceFixtures } from "./chain-conformance-checks.ts";

// The suite every chain adapter must pass (ADR-017 section 8). Each group runs only for a port the
// adapter declares, so an adapter is held to exactly the capabilities it claims.
export function defineChainAdapterConformance(
  name: string,
  create: () => { adapter: ChainAdapter; fixtures: ChainConformanceFixtures },
): void {
  describe(`chain adapter conformance: ${name}`, () => {
    const { adapter, fixtures } = create();
    const declares = (port: keyof typeof portCapabilities): boolean =>
      adapter.capabilities.has(portCapabilities[port]);

    it("declares exactly the capabilities of the ports it provides", () =>
      checkCapabilityConsistency(adapter));

    it.runIf(declares("addressCodec"))(
      "canonicalises addresses and rejects invalid, cross-chain, and unserved input",
      () => checkAddressCodec(adapter, fixtures),
    );
    it.runIf(declares("builder"))(
      "shows in the summary exactly what it builds",
      async () => void (await checkSummaryFidelity(adapter, fixtures)),
    );
    it.runIf(declares("builder"))(
      "verifies what was signed and refuses a tampered transaction",
      async () => void (await checkSigningVerification(adapter, fixtures)),
    );
    it.runIf(
      declares("broadcaster") && declares("observer") && declares("builder"),
    )("broadcasts idempotently and observes repeatably", () =>
      checkBroadcastAndObservation(adapter, fixtures),
    );
    it.runIf(declares("reader") && declares("addressCodec"))(
      "reads head and balances on the requested chain",
      () => checkReader(adapter, fixtures),
    );
  });
}

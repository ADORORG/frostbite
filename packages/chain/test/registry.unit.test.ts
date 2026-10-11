import { describe, expect, it } from "vitest";

import { portCapabilities, portNames } from "../src/adapter.ts";
import { createChainRegistry } from "../src/registry.ts";
import {
  alpha,
  beta,
  chainConfig,
  echoCodec,
  familyB,
  fakeAdapter,
  gamma,
  silentBroadcaster,
  silentObserver,
} from "./support/chains.ts";

function boot(
  overrides: Partial<Parameters<typeof createChainRegistry>[0]> = {},
) {
  return createChainRegistry({
    adapters: [fakeAdapter()],
    chains: [chainConfig()],
    ...overrides,
  });
}

describe("createChainRegistry", () => {
  it("resolves an enabled chain's config, adapter, port, and capabilities", () => {
    const adapter = fakeAdapter();
    const registry = boot({ adapters: [adapter] });
    expect(registry.enabled().map(({ chainId }) => chainId)).toEqual([alpha]);
    expect(registry.config(alpha).displayName).toBe("Alpha");
    expect(registry.adapter(alpha)).toBe(adapter);
    expect(registry.port(alpha, "addressCodec")).toBe(echoCodec);
    expect(registry.supports(alpha, "address:codec")).toBe(true);
    expect(registry.supports(alpha, "transaction:build")).toBe(false);
  });

  it("does not resolve a chain that is configured but disabled, and does not need its adapter", () => {
    const registry = boot({
      adapters: [fakeAdapter()],
      chains: [
        chainConfig(),
        chainConfig({ chainId: gamma, enabled: false, family: familyB }),
      ],
    });
    expect(registry.enabled()).toHaveLength(1);
    expect(() => registry.config(gamma)).toThrow(/not enabled/u);
    expect(() => registry.adapter(gamma)).toThrow(/not enabled/u);
    expect(() => registry.port(gamma, "addressCodec")).toThrow(/not enabled/u);
  });

  it("allows an adapter whose family has no enabled chain", () => {
    expect(() =>
      boot({ adapters: [fakeAdapter(), fakeAdapter({ family: familyB })] }),
    ).not.toThrow();
  });

  it("fails boot when an enabled chain has no adapter for its family", () => {
    expect(() =>
      boot({ adapters: [fakeAdapter({ family: familyB })] }),
    ).toThrow(/no adapter is registered for family family-a/u);
  });

  it("fails boot when two adapters claim one family", () => {
    expect(() => boot({ adapters: [fakeAdapter(), fakeAdapter()] })).toThrow(
      /Two adapters claim chain family family-a/u,
    );
  });

  it("fails boot when the adapter does not support the chain", () => {
    expect(() => boot({ chains: [chainConfig({ chainId: gamma })] })).toThrow(
      /does not support chain other:gamma/u,
    );
  });

  it("refuses a test-only adapter for any chain that is not a test chain", () => {
    const adapters = [fakeAdapter({ testOnly: true })];
    for (const role of ["public-beta", "production"] as const) {
      expect(() => boot({ adapters, chains: [chainConfig({ role })] })).toThrow(
        /Test-only adapter family-a cannot serve/u,
      );
    }
    expect(() =>
      boot({ adapters, chains: [chainConfig({ role: "test" })] }),
    ).not.toThrow();
  });

  it("fails boot when a feature needs a capability the adapter lacks", () => {
    expect(() => boot({ requiredCapabilities: ["transaction:build"] })).toThrow(
      /lacks required capability transaction:build/u,
    );
    expect(() =>
      boot({ requiredCapabilities: ["address:codec"] }),
    ).not.toThrow();
  });

  it("does not check disabled chains against required capabilities", () => {
    expect(() =>
      boot({
        chains: [chainConfig({ enabled: false })],
        requiredCapabilities: ["transaction:build"],
      }),
    ).not.toThrow();
  });

  it("fails boot on an invalid chain configuration", () => {
    expect(() => boot({ chains: [chainConfig(), chainConfig()] })).toThrow(
      /unique/u,
    );
    expect(() =>
      boot({ chains: [chainConfig({ displayName: " " })] }),
    ).toThrow();
  });

  it("requires a declared capability for every provided port, and a port for every declared capability", () => {
    expect(() =>
      boot({
        adapters: [
          fakeAdapter({
            ports: { addressCodec: echoCodec, broadcaster: silentBroadcaster },
          }),
        ],
      }),
    ).toThrow(/provides broadcaster without declaring transaction:broadcast/u);
    expect(() =>
      boot({
        adapters: [
          fakeAdapter({
            capabilities: new Set(["address:codec", "transaction:observe"]),
          }),
        ],
      }),
    ).toThrow(/declares transaction:observe without providing observer/u);
    expect(() =>
      boot({
        adapters: [
          fakeAdapter({
            capabilities: new Set([
              "address:codec",
              "transaction:broadcast",
              "transaction:observe",
            ]),
            ports: {
              addressCodec: echoCodec,
              broadcaster: silentBroadcaster,
              observer: silentObserver,
            },
          }),
        ],
      }),
    ).not.toThrow();
  });

  it("fails boot on a capability name that is not well formed", () => {
    const malformed = /Expected a capability name/u;
    expect(() =>
      boot({
        adapters: [
          fakeAdapter({
            capabilities: new Set(["address:codec", "Bad Name"]),
          }),
        ],
      }),
    ).toThrow(malformed);
    expect(() => boot({ requiredCapabilities: ["codec"] })).toThrow(malformed);
  });

  it("answers a missing port with an error, not undefined", () => {
    expect(() => boot().port(alpha, "reader")).toThrow(/no reader port/u);
  });

  it("allows broadcast on a test chain, and elsewhere only once the release gate is open", () => {
    const registry = boot({
      chains: [
        chainConfig({ releaseGate: "closed", role: "test" }),
        chainConfig({
          chainId: beta,
          releaseGate: "closed",
          role: "production",
        }),
      ],
    });
    expect(registry.broadcastAllowed(alpha)).toBe(true);
    expect(registry.broadcastAllowed(beta)).toBe(false);
    const open = boot({
      chains: [chainConfig({ releaseGate: "open", role: "production" })],
    });
    expect(open.broadcastAllowed(alpha)).toBe(true);
  });
});

describe("port capabilities", () => {
  it("lists every port exactly once", () => {
    expect([...portNames].sort()).toEqual(Object.keys(portCapabilities).sort());
  });

  it("gives every port a distinct capability", () => {
    const values = Object.values(portCapabilities);
    expect(new Set(values).size).toBe(values.length);
  });
});

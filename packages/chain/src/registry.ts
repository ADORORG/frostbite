import {
  chainCapabilitySchema,
  chainConfigListSchema,
  type ChainConfig,
  type ChainFamilyId,
  type ChainRef,
} from "@frostbite/shared/chain";

import {
  portCapabilities,
  portNames,
  type ChainAdapter,
  type ChainCapability,
  type PortName,
} from "./adapter.ts";
import type { ChainPorts } from "./ports.ts";

export interface ChainRegistryOptions {
  readonly adapters: readonly ChainAdapter[];
  // The raw configuration is validated here, so a bad record fails boot with a schema error.
  readonly chains: readonly ChainConfig[];
  // Capabilities the registered features need from every enabled chain.
  readonly requiredCapabilities?: readonly ChainCapability[];
}

export interface ChainRegistry {
  adapter(chain: ChainRef): ChainAdapter;
  // A chain may be configured but kept from broadcast: true for a `test` chain, and for any other
  // chain only once its release gate is open.
  broadcastAllowed(chain: ChainRef): boolean;
  config(chain: ChainRef): ChainConfig;
  enabled(): readonly ChainConfig[];
  port<Name extends PortName>(chain: ChainRef, name: Name): ChainPorts[Name];
  supports(chain: ChainRef, capability: ChainCapability): boolean;
}

interface Resolved {
  readonly adapter: ChainAdapter;
  readonly config: ChainConfig;
}

function indexAdapters(
  adapters: readonly ChainAdapter[],
): ReadonlyMap<ChainFamilyId, ChainAdapter> {
  const byFamily = new Map<ChainFamilyId, ChainAdapter>();
  for (const adapter of adapters) {
    if (byFamily.has(adapter.family)) {
      throw new Error(`Two adapters claim chain family ${adapter.family}.`);
    }
    for (const name of portNames) {
      const declared = adapter.capabilities.has(portCapabilities[name]);
      const provided = adapter.ports[name] !== undefined;
      if (provided && !declared) {
        throw new Error(
          `Adapter ${adapter.family} provides ${name} without declaring ${portCapabilities[name]}.`,
        );
      }
      if (declared && !provided) {
        throw new Error(
          `Adapter ${adapter.family} declares ${portCapabilities[name]} without providing ${name}.`,
        );
      }
    }
    for (const capability of adapter.capabilities) {
      chainCapabilitySchema.parse(capability);
    }
    byFamily.set(adapter.family, adapter);
  }
  return byFamily;
}

// Returns the adapter for an enabled chain after every boot-time check, or throws.
function checkEnabledChain(
  chain: ChainConfig,
  adapter: ChainAdapter | undefined,
  required: readonly ChainCapability[],
): ChainAdapter {
  if (!adapter) {
    throw new Error(
      `Chain ${chain.chainId} is enabled but no adapter is registered for family ${chain.family}.`,
    );
  }
  if (!adapter.supports(chain.chainId)) {
    throw new Error(
      `Adapter ${adapter.family} does not support chain ${chain.chainId}.`,
    );
  }
  if (adapter.testOnly && chain.role !== "test") {
    throw new Error(
      `Test-only adapter ${adapter.family} cannot serve ${chain.role} chain ${chain.chainId}.`,
    );
  }
  for (const capability of required) {
    if (!adapter.capabilities.has(capability)) {
      throw new Error(
        `Chain ${chain.chainId} lacks required capability ${capability}.`,
      );
    }
  }
  return adapter;
}

// Checks, once at boot, that the configured chains and the registered adapters agree (ADR-017
// section 2). Disabled chains are configuration only: they are not resolvable and not checked.
export function createChainRegistry(
  options: ChainRegistryOptions,
): ChainRegistry {
  const chains = chainConfigListSchema.parse(options.chains);
  const required = options.requiredCapabilities?.map((capability) =>
    chainCapabilitySchema.parse(capability),
  );
  const adapters = indexAdapters(options.adapters);
  const resolved = new Map<ChainRef, Resolved>();
  for (const config of chains.filter(({ enabled }) => enabled)) {
    const adapter = checkEnabledChain(
      config,
      adapters.get(config.family),
      required ?? [],
    );
    resolved.set(config.chainId, { adapter, config });
  }

  const find = (chain: ChainRef): Resolved => {
    const found = resolved.get(chain);
    if (!found) throw new Error(`Chain is not enabled: ${chain}.`);
    return found;
  };

  return {
    adapter: (chain) => find(chain).adapter,
    broadcastAllowed: (chain) => {
      const { releaseGate, role } = find(chain).config;
      return role === "test" || releaseGate === "open";
    },
    config: (chain) => find(chain).config,
    enabled: () => [...resolved.values()].map(({ config }) => config),
    port: (chain, name) => {
      const found = find(chain).adapter.ports[name];
      if (found === undefined) {
        throw new Error(`Chain ${chain} has no ${name} port.`);
      }
      return found;
    },
    supports: (chain, capability) =>
      find(chain).adapter.capabilities.has(capability),
  };
}

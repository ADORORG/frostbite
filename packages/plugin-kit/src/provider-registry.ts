import {
  providerManifestSchema,
  type ProviderId,
  type ProviderManifest,
} from "@frostbite/shared/providers";
import type { ProviderCapability } from "@frostbite/shared/features";

export interface ProviderEntrypoint {
  readonly capabilities: readonly ProviderCapability[];
  readonly createServices?: () => Readonly<Partial<ProviderServices>>;
  readonly id: ProviderId;
  readonly version: string;
}

declare const providerServicesBrand: unique symbol;

export interface ProviderServices {
  readonly [providerServicesBrand]?: never;
}

type ServiceCapability = Extract<keyof ProviderServices, string>;

export interface ProviderRegistration {
  readonly load: () => Promise<ProviderEntrypoint>;
  readonly manifest: ProviderManifest;
}

export interface ProviderRegistry {
  hasCapability(capability: ProviderCapability): boolean;
  list(): readonly ProviderManifest[];
  load(id: ProviderId): Promise<ProviderEntrypoint>;
  resolve<Capability extends ServiceCapability>(
    capability: Capability,
  ): Promise<ProviderServices[Capability]>;
}

function freezeManifest(manifest: ProviderManifest): ProviderManifest {
  return Object.freeze({
    ...manifest,
    capabilities: Object.freeze([...manifest.capabilities]),
    requiredDecisionGates: Object.freeze([...manifest.requiredDecisionGates]),
  });
}

function capabilityKey(values: readonly ProviderCapability[]): string {
  return [...values].sort().join("\n");
}

export function defineProvider(
  registration: ProviderRegistration,
): ProviderRegistration {
  return {
    ...registration,
    manifest: freezeManifest(
      providerManifestSchema.parse(registration.manifest),
    ),
  };
}

export function createProviderRegistry(
  definitions: readonly ProviderRegistration[],
): ProviderRegistry {
  const registrations = new Map<ProviderId, ProviderRegistration>();
  const capabilityOwners = new Map<ProviderCapability, ProviderId>();
  const entrypointLoads = new Map<ProviderId, Promise<ProviderEntrypoint>>();
  const runtimeServices = new Map<
    ProviderId,
    Readonly<Partial<ProviderServices>>
  >();

  for (const definition of definitions) {
    const registration = defineProvider(definition);
    if (registrations.has(registration.manifest.id)) {
      throw new Error(
        `Duplicate provider registration: ${registration.manifest.id}.`,
      );
    }
    registrations.set(registration.manifest.id, registration);
    for (const capability of registration.manifest.capabilities) {
      const owner = capabilityOwners.get(capability);
      if (owner) {
        throw new Error(
          `Provider capability ${capability} is owned by both ${owner} and ${registration.manifest.id}.`,
        );
      }
      capabilityOwners.set(capability, registration.manifest.id);
    }
  }

  const loadOnce = async (id: ProviderId): Promise<ProviderEntrypoint> => {
    const registration = registrations.get(id);
    if (!registration) throw new Error(`Provider is not registered: ${id}.`);

    const entrypoint = await registration.load();
    if (
      entrypoint.id !== registration.manifest.id ||
      entrypoint.version !== registration.manifest.version
    ) {
      throw new Error("Loaded provider identity does not match its manifest.");
    }
    if (
      capabilityKey(entrypoint.capabilities) !==
      capabilityKey(registration.manifest.capabilities)
    ) {
      throw new Error(
        "Loaded provider capabilities do not match its manifest.",
      );
    }
    return entrypoint;
  };

  const load = (id: ProviderId): Promise<ProviderEntrypoint> => {
    const pending = entrypointLoads.get(id);
    if (pending) return pending;
    const created = loadOnce(id);
    entrypointLoads.set(id, created);
    return created;
  };

  return {
    hasCapability: (capability) => capabilityOwners.has(capability),
    list: () => [...registrations.values()].map(({ manifest }) => manifest),
    load,
    resolve: async (capability) => {
      const owner = capabilityOwners.get(capability);
      if (!owner)
        throw new Error(
          `Provider capability is not registered: ${capability}.`,
        );
      const entrypoint = await load(owner);
      let services = runtimeServices.get(owner);
      if (!services) {
        services = entrypoint.createServices?.();
        if (!services) {
          throw new Error(`Provider ${owner} did not create runtime services.`);
        }
        for (const exposed of Object.keys(services)) {
          if (!entrypoint.capabilities.includes(exposed)) {
            throw new Error(
              `Provider ${owner} created undeclared service ${exposed}.`,
            );
          }
        }
        runtimeServices.set(owner, services);
      }
      const service = services[capability];
      if (service === undefined) {
        throw new Error(
          `Provider ${owner} did not create service ${capability}.`,
        );
      }
      return service;
    },
  };
}

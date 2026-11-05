import type {
  FeatureManifest,
  RouteContribution,
} from "@frostbite/shared/features";
import {
  assertDecisionGateOpen,
  type DecisionCatalog,
  type DecisionGateId,
} from "@frostbite/shared/decisions";

import type { FeatureRegistry } from "./registry.js";
import type { ProviderRegistry } from "./provider-registry.js";

export interface PlatformBootManifest {
  readonly features: readonly FeatureManifest[];
  readonly providerCount: number;
}

function assertProviderCapabilities(
  features: readonly FeatureManifest[],
  providers: ProviderRegistry,
): void {
  for (const feature of features) {
    for (const capability of feature.requiredProviderCapabilities) {
      if (!providers.hasCapability(capability)) {
        throw new Error(
          `Feature ${feature.id} requires missing provider capability: ${capability}.`,
        );
      }
    }
  }
}

function assertDecisionGates(
  gateIds: readonly DecisionGateId[],
  decisions: DecisionCatalog,
): void {
  for (const gateId of gateIds) assertDecisionGateOpen(decisions, gateId);
}

function assertUniqueRoutes(
  features: readonly FeatureManifest[],
  reservedRoutes: readonly RouteContribution[],
): void {
  const routeOwners = new Map<string, string>();
  const operationOwners = new Map<string, string>();

  for (const route of reservedRoutes) {
    routeOwners.set(`${route.method} ${route.path}`, "platform infrastructure");
    operationOwners.set(route.operationId, "platform infrastructure");
  }

  for (const feature of features) {
    if (
      feature.routes.length > 0 &&
      !feature.capabilities.includes("api-routes")
    ) {
      throw new Error(
        `Feature ${feature.id} contributes routes without the api-routes capability.`,
      );
    }
    for (const route of feature.routes) {
      const routeShape = route.path.replace(
        /:[A-Za-z][A-Za-z0-9]*/gu,
        ":parameter",
      );
      const routeKey = `${route.method} ${routeShape}`;
      const routeOwner = routeOwners.get(routeKey);
      if (routeOwner) {
        throw new Error(
          `Route collision for ${routeKey}: ${routeOwner} and ${feature.id}.`,
        );
      }
      const operationOwner = operationOwners.get(route.operationId);
      if (operationOwner) {
        throw new Error(
          `Operation ID collision for ${route.operationId}: ${operationOwner} and ${feature.id}.`,
        );
      }
      routeOwners.set(routeKey, feature.id);
      operationOwners.set(route.operationId, feature.id);
    }
  }
}

function assertUniquePages(features: readonly FeatureManifest[]): void {
  const ownedPages: { readonly owner: string; readonly path: string }[] = [];
  const isDynamic = (segment: string) => segment.startsWith("[");
  const overlaps = (left: string, right: string) => {
    const leftSegments = left.split("/");
    const rightSegments = right.split("/");
    return (
      leftSegments.length === rightSegments.length &&
      leftSegments.every(
        (segment, index) =>
          segment === rightSegments[index] ||
          isDynamic(segment) ||
          isDynamic(rightSegments[index] ?? ""),
      )
    );
  };
  for (const feature of features) {
    for (const page of feature.pages) {
      const requiredCapability =
        page.access.kind === "public" ? "public-page" : "authenticated-page";
      if (!feature.capabilities.includes(requiredCapability)) {
        throw new Error(
          `Feature ${feature.id} contributes a ${page.access.kind} page without the ${requiredCapability} capability.`,
        );
      }
      const conflictingPage = ownedPages.find(
        ({ path }) =>
          path === page.path ||
          (path.includes("[") &&
            page.path.includes("[") &&
            overlaps(path, page.path)),
      );
      if (conflictingPage)
        throw new Error(
          `Page collision between ${conflictingPage.path} and ${page.path}: ${conflictingPage.owner} and ${feature.id}.`,
        );
      ownedPages.push({ owner: feature.id, path: page.path });
    }
  }
}

export function validatePlatformBoot(input: {
  readonly decisionCatalog: DecisionCatalog;
  readonly featureRegistry: FeatureRegistry;
  readonly providerRegistry: ProviderRegistry;
  readonly reservedRoutes?: readonly RouteContribution[];
}): PlatformBootManifest {
  const features = input.featureRegistry.list();
  for (const feature of features) {
    assertDecisionGates(feature.requiredDecisionGates, input.decisionCatalog);
  }
  for (const provider of input.providerRegistry.list()) {
    assertDecisionGates(provider.requiredDecisionGates, input.decisionCatalog);
  }
  assertProviderCapabilities(features, input.providerRegistry);
  assertUniqueRoutes(features, input.reservedRoutes ?? []);
  assertUniquePages(features);

  return Object.freeze({
    features: Object.freeze([...features]),
    providerCount: input.providerRegistry.list().length,
  });
}

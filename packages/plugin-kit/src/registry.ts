import {
  featureManifestSchema,
  type FeatureCapability,
  type FeatureId,
  type FeatureManifest,
  type NavigationContribution,
  type PageAccessRequirement,
} from "@ador/shared/features";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { RegisteredHttpOperation } from "@ador/http/registered-operation";
import type { ReactNode } from "react";
import { collectHomeSections, type HomeSection } from "./home-sections.ts";
import type { NavigationItem } from "./navigation.ts";
import type { PageMetadata } from "./page-metadata.ts";
import { dynamicSegmentCount, matchPage } from "./page-match.ts";

export type { HomeSection } from "./home-sections.ts";
export type { PageMetadata } from "./page-metadata.ts";

export interface FeaturePageContribution {
  readonly access: PageAccessRequirement;
  // What the page tells a search engine or a link preview. A page that declares none is `private`: kept out of search results.
  readonly metadata?: (
    context: PageMetadataContext,
  ) => PageMetadata | Promise<PageMetadata>;
  readonly path: `/${string}`;
  readonly render: (
    context: PageRenderContext,
  ) => ReactNode | Promise<ReactNode>;
}

export interface PageMetadataContext {
  readonly params: Readonly<Record<string, string>>;
}

export interface PageRenderContext {
  readonly actorUserId: UuidV7 | null;
  // Every feature's parts of the landing page; only the landing page reads them, and a page rendered without them has none.
  readonly homeSections?: readonly HomeSection[];
  readonly navigation: readonly NavigationItem[];
  readonly params: Readonly<Record<string, string>>;
  // The address's query string as the framework read it, for a page whose content depends on it (a search); left out by a caller with none.
  readonly searchParams?: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
}

export interface ResolvedFeaturePage {
  readonly page: FeaturePageContribution;
  readonly params: Readonly<Record<string, string>>;
}

export interface FeatureLoadContext {
  readonly registeredFeatureCount: number;
  readonly registeredFeatureIds: readonly FeatureId[];
}

export interface FeatureEntrypoint {
  readonly capabilities: readonly FeatureCapability[];
  readonly homeSections?: readonly HomeSection[];
  readonly id: FeatureId;
  readonly version: string;
  readonly operations?: readonly RegisteredHttpOperation[];
  readonly pages?: readonly FeaturePageContribution[];
  // The addresses of this feature's pages that are worth listing in the sitemap: public, shared, and existing right now. A page it
  // does not list can still be visited; it is only not offered to crawlers.
  readonly sitemapPaths?: () =>
    readonly `/${string}`[] | Promise<readonly `/${string}`[]>;
}

export interface FeatureRegistration {
  readonly load: (context: FeatureLoadContext) => Promise<FeatureEntrypoint>;
  readonly manifest: FeatureManifest;
}

export interface FeatureRegistry {
  has(id: FeatureId): boolean;
  list(): readonly FeatureManifest[];
  // Every feature's parts of the landing page, in the order they are shown.
  listHomeSections(): Promise<readonly HomeSection[]>;
  listNavigation(): readonly NavigationContribution[];
  // Every feature's sitemap addresses, each once, in a stable order.
  listSitemapPaths(): Promise<readonly `/${string}`[]>;
  load(id: FeatureId): Promise<FeatureEntrypoint>;
  loadAll(): Promise<readonly FeatureEntrypoint[]>;
  resolvePage(path: string): Promise<ResolvedFeaturePage | undefined>;
}

function freezeManifest(manifest: FeatureManifest): FeatureManifest {
  return Object.freeze({
    ...manifest,
    capabilities: Object.freeze([...manifest.capabilities]),
    dependencies: Object.freeze([...manifest.dependencies]),
    navigation: Object.freeze(
      manifest.navigation.map((item) =>
        Object.freeze({ ...item, access: Object.freeze({ ...item.access }) }),
      ),
    ),
    requiredProviderCapabilities: Object.freeze([
      ...manifest.requiredProviderCapabilities,
    ]),
    requiredDecisionGates: Object.freeze([...manifest.requiredDecisionGates]),
    pages: Object.freeze(
      manifest.pages.map((page) => Object.freeze({ ...page })),
    ),
    routes: Object.freeze(
      manifest.routes.map((route) => Object.freeze({ ...route })),
    ),
  });
}

function assertSameCapabilities(
  expected: readonly FeatureCapability[],
  actual: readonly FeatureCapability[],
): void {
  const normalize = (values: readonly FeatureCapability[]) =>
    [...values].sort().join("\n");

  if (normalize(expected) !== normalize(actual)) {
    throw new Error("Loaded feature capabilities do not match its manifest.");
  }
}

function assertRuntimeContributions(
  manifest: FeatureManifest,
  entrypoint: FeatureEntrypoint,
): void {
  const expected = manifest.routes
    .map(({ method, operationId, path }) => `${method} ${path} ${operationId}`)
    .sort();
  const actual = (entrypoint.operations ?? [])
    .map(({ route }) => `${route.method} ${route.path} ${route.operationId}`)
    .sort();
  if (expected.join("\n") !== actual.join("\n")) {
    throw new Error("Loaded feature routes do not match its manifest.");
  }
  const describePage = ({
    access,
    path,
  }: {
    readonly access: PageAccessRequirement;
    readonly path: string;
  }) => `${path} ${JSON.stringify(access)}`;
  const expectedPages = manifest.pages.map(describePage).sort();
  const actualPages = (entrypoint.pages ?? []).map(describePage).sort();
  if (expectedPages.join("\n") !== actualPages.join("\n")) {
    throw new Error("Loaded feature pages do not match its manifest.");
  }
  // A feature offers the landing page something exactly when it says it does.
  if (
    manifest.capabilities.includes("home-section") !==
    (entrypoint.homeSections ?? []).length > 0
  ) {
    throw new Error("Loaded feature home sections do not match its manifest.");
  }
}

function assertDependencyGraph(
  registrations: ReadonlyMap<FeatureId, FeatureRegistration>,
): void {
  const complete = new Set<FeatureId>();
  const active = new Set<FeatureId>();

  const visit = (id: FeatureId): void => {
    if (complete.has(id)) return;
    if (active.has(id))
      throw new Error(`Feature dependency cycle includes ${id}.`);

    const registration = registrations.get(id);
    if (!registration) throw new Error(`Missing feature dependency: ${id}.`);

    active.add(id);
    registration.manifest.dependencies.forEach(visit);
    active.delete(id);
    complete.add(id);
  };

  registrations.forEach(({ manifest }) => visit(manifest.id));
}

function assertUniqueNavigation(
  registrations: ReadonlyMap<FeatureId, FeatureRegistration>,
): void {
  const owners = new Map<string, FeatureId>();
  registrations.forEach(({ manifest }) => {
    manifest.navigation.forEach(({ href }) => {
      const owner = owners.get(href);
      if (owner) {
        throw new Error(
          `Duplicate navigation destination ${href} in ${owner} and ${manifest.id}.`,
        );
      }
      owners.set(href, manifest.id);
    });
  });
}

export function defineFeature(
  registration: FeatureRegistration,
): FeatureRegistration {
  return {
    ...registration,
    manifest: freezeManifest(
      featureManifestSchema.parse(registration.manifest),
    ),
  };
}

export function createFeatureRegistry(
  definitions: readonly FeatureRegistration[],
): FeatureRegistry {
  const registrations = new Map<FeatureId, FeatureRegistration>();

  for (const definition of definitions) {
    const registration = defineFeature(definition);
    if (registrations.has(registration.manifest.id)) {
      throw new Error(
        `Duplicate feature registration: ${registration.manifest.id}.`,
      );
    }
    registrations.set(registration.manifest.id, registration);
  }

  assertDependencyGraph(registrations);
  assertUniqueNavigation(registrations);
  const registeredFeatureIds = Object.freeze([...registrations.keys()]);

  const load = async (id: FeatureId): Promise<FeatureEntrypoint> => {
    const registration = registrations.get(id);
    if (!registration) throw new Error(`Feature is not registered: ${id}.`);

    const entrypoint = await registration.load({
      registeredFeatureCount: registrations.size,
      registeredFeatureIds,
    });
    if (
      entrypoint.id !== registration.manifest.id ||
      entrypoint.version !== registration.manifest.version
    ) {
      throw new Error("Loaded feature identity does not match its manifest.");
    }
    assertSameCapabilities(
      registration.manifest.capabilities,
      entrypoint.capabilities,
    );
    assertRuntimeContributions(registration.manifest, entrypoint);
    return entrypoint;
  };

  const loadAll = async (): Promise<readonly FeatureEntrypoint[]> => {
    return Promise.all([...registrations.keys()].map(load));
  };

  return {
    has: (id) => registrations.has(id),
    list: () => [...registrations.values()].map(({ manifest }) => manifest),
    listHomeSections: async () => collectHomeSections(await loadAll()),
    listNavigation: () =>
      Object.freeze(
        [...registrations.values()].flatMap(({ manifest }) =>
          manifest.navigation.map((item) => item),
        ),
      ),
    listSitemapPaths: async () => {
      const lists = await Promise.all(
        (await loadAll()).map(({ sitemapPaths }) => sitemapPaths?.() ?? []),
      );
      return Object.freeze([...new Set(lists.flat())].sort());
    },
    load,
    loadAll,
    resolvePage: async (path) => {
      const entrypoints = await loadAll();
      const pages = entrypoints
        .flatMap(({ pages = [] }) => pages)
        .sort(
          (left, right) =>
            dynamicSegmentCount(left.path) - dynamicSegmentCount(right.path),
        );
      for (const page of pages) {
        const match = matchPage(page, path);
        if (match) return match;
      }
      return undefined;
    },
  };
}

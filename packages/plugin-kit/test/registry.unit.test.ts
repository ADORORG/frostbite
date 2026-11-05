import { describe, expect, it } from "vitest";

import { registerHttpOperation } from "@frostbite/http/registered-operation";
import {
  platformStatusInputSchema,
  platformStatusSchema,
} from "@frostbite/shared/platform";

import {
  createFeatureRegistry,
  defineFeature,
  type FeatureLoadContext,
  type FeatureRegistration,
} from "../src/registry.js";

function registration(
  id: string,
  dependencies: readonly string[] = [],
  navigation: FeatureRegistration["manifest"]["navigation"] = [],
): FeatureRegistration {
  const capabilities = navigation.length
    ? (["public-page", "navigation"] as const)
    : (["public-page"] as const);
  return {
    manifest: {
      id,
      version: "1.0.0",
      capabilities,
      dependencies,
      navigation,
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      pages: [],
      routes: [],
    },
    load: async () => ({
      id,
      version: "1.0.0",
      capabilities,
    }),
  };
}

describe("createFeatureRegistry", () => {
  it("lists, locates, and loads a valid registration", async () => {
    let loadContext: FeatureLoadContext | undefined;
    const catalog = registration("catalog");
    const registry = createFeatureRegistry([
      {
        ...catalog,
        load: async (context) => {
          loadContext = context;
          return catalog.load(context);
        },
      },
    ]);
    expect(registry.has("catalog")).toBe(true);
    expect(registry.list()).toHaveLength(1);
    await expect(registry.load("catalog")).resolves.toMatchObject({
      id: "catalog",
    });
    expect(loadContext).toEqual({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["catalog"],
    });
  });

  it("does not expose mutable internal manifests", () => {
    const registry = createFeatureRegistry([registration("catalog")]);
    const [manifest] = registry.list();

    expect(manifest && Reflect.set(manifest, "id", "changed")).toBe(false);
    expect(
      manifest && Reflect.set(manifest.requiredDecisionGates, "0", "release"),
    ).toBe(false);
    expect(registry.list()[0]?.id).toBe("catalog");
  });

  it("rejects duplicate registrations", () => {
    expect(() =>
      createFeatureRegistry([registration("catalog"), registration("catalog")]),
    ).toThrow("Duplicate feature registration");
  });

  it("rejects missing and cyclic dependencies", () => {
    expect(() =>
      createFeatureRegistry([registration("catalog", ["missing"])]),
    ).toThrow("Missing feature dependency");
    expect(() =>
      createFeatureRegistry([
        registration("catalog", ["launches"]),
        registration("launches", ["catalog"]),
      ]),
    ).toThrow("Feature dependency cycle");
  });

  it("rejects an unknown feature load", async () => {
    const registry = createFeatureRegistry([]);
    await expect(registry.load("missing")).rejects.toThrow("not registered");
  });

  it("rejects entrypoint identity and capability drift", async () => {
    const identityDrift = {
      ...registration("catalog"),
      load: async () => ({
        id: "other",
        version: "1.0.0",
        capabilities: ["public-page"] as const,
      }),
    };
    await expect(
      createFeatureRegistry([identityDrift]).load("catalog"),
    ).rejects.toThrow("identity");

    const capabilityDrift = {
      ...registration("catalog"),
      load: async () => ({
        id: "catalog",
        version: "1.0.0",
        capabilities: ["navigation"] as const,
      }),
    };
    await expect(
      createFeatureRegistry([capabilityDrift]).load("catalog"),
    ).rejects.toThrow("capabilities");
  });

  it("resolves only registered pages and rejects contribution drift", async () => {
    const detachable: FeatureRegistration = {
      ...registration("catalog"),
      manifest: {
        ...registration("catalog").manifest,
        pages: [{ access: { kind: "public" }, path: "/catalog" }],
      },
      load: async () => ({
        capabilities: ["public-page"],
        id: "catalog",
        pages: [
          {
            access: { kind: "public" },
            path: "/catalog",
            render: () => "catalog",
          },
        ],
        version: "1.0.0",
      }),
    };
    const registry = createFeatureRegistry([detachable]);

    await expect(registry.resolvePage("/catalog")).resolves.toMatchObject({
      page: { path: "/catalog" },
      params: {},
    });
    await expect(
      createFeatureRegistry([]).resolvePage("/catalog"),
    ).resolves.toBeUndefined();

    const routeDrift: FeatureRegistration = {
      ...registration("catalog"),
      manifest: {
        ...registration("catalog").manifest,
        routes: [
          { method: "GET", operationId: "getCatalog", path: "/api/v1/catalog" },
        ],
      },
    };
    await expect(
      createFeatureRegistry([routeDrift]).load("catalog"),
    ).rejects.toThrow("routes");

    const operationIdDrift: FeatureRegistration = {
      ...registration("catalog"),
      manifest: {
        ...registration("catalog").manifest,
        routes: [
          { method: "GET", operationId: "getCatalog", path: "/api/v1/catalog" },
        ],
      },
      load: async () => ({
        capabilities: ["public-page"],
        id: "catalog",
        operations: [
          registerHttpOperation({
            access: { kind: "public" },
            applicationErrors: [],
            execute: async () => ({
              ok: true,
              value: {
                apiVersion: "v1",
                registeredFeatures: 1,
                stage: "foundation",
                transactionalActions: "gated",
              },
            }),
            cache: { kind: "revalidate" },
            idempotency: "none",
            input: "none",
            inputSchema: platformStatusInputSchema,
            method: "GET",
            operationId: "getDifferentCatalog",
            outputSchema: platformStatusSchema,
            path: "/api/v1/catalog",
          }),
        ],
        version: "1.0.0",
      }),
    };
    await expect(
      createFeatureRegistry([operationIdDrift]).load("catalog"),
    ).rejects.toThrow("routes");

    const pageDrift = {
      ...registration("catalog"),
      load: async () => ({
        capabilities: ["public-page"] as const,
        id: "catalog",
        pages: [
          {
            access: { kind: "public" as const },
            path: "/catalog" as const,
            render: () => "catalog",
          },
        ],
        version: "1.0.0",
      }),
    };
    await expect(
      createFeatureRegistry([pageDrift]).load("catalog"),
    ).rejects.toThrow("pages");
  });

  it("matches dynamic pages, extracts parameters, and prefers static pages", async () => {
    const dynamic: FeatureRegistration = {
      ...registration("catalog"),
      manifest: {
        ...registration("catalog").manifest,
        pages: [
          { access: { kind: "public" }, path: "/catalog/new" },
          { access: { kind: "public" }, path: "/catalog/[slug]" },
        ],
      },
      load: async () => ({
        capabilities: ["public-page"],
        id: "catalog",
        pages: [
          {
            access: { kind: "public" },
            path: "/catalog/[slug]",
            render: () => "detail",
          },
          {
            access: { kind: "public" },
            path: "/catalog/new",
            render: () => "new",
          },
        ],
        version: "1.0.0",
      }),
    };
    const registry = createFeatureRegistry([dynamic]);

    await expect(
      registry.resolvePage("/catalog/orbit-one"),
    ).resolves.toMatchObject({
      page: { path: "/catalog/[slug]" },
      params: { slug: "orbit-one" },
    });
    await expect(registry.resolvePage("/catalog/new")).resolves.toMatchObject({
      page: { path: "/catalog/new" },
      params: {},
    });
    await expect(
      registry.resolvePage("/catalog/a/extra"),
    ).resolves.toBeUndefined();
    // A dynamic page is never matched without its segment, so a page can rely on its parameter being a
    // non-empty string (the pages' empty-string fallbacks only satisfy the type).
    await expect(registry.resolvePage("/catalog/")).resolves.toBeUndefined();
    await expect(registry.resolvePage("/catalog")).resolves.toBeUndefined();
  });
});

describe("defineFeature", () => {
  it("rejects a malformed manifest before registration", () => {
    expect(() => defineFeature(registration("INVALID"))).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import type { FeatureRegistration } from "../src/registry.js";
import { createFeatureRegistry } from "../src/registry.js";

const navigation = [
  {
    access: { kind: "public" as const },
    area: "main" as const,
    href: "/catalog",
    label: "Catalog",
  },
] as const;

function registration(id: string): FeatureRegistration {
  return {
    manifest: {
      capabilities: ["public-page", "navigation"],
      dependencies: [],
      id,
      navigation,
      pages: [{ access: { kind: "public" }, path: "/catalog" }],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [],
      version: "1.0.0",
    },
    load: async () => ({
      capabilities: ["public-page", "navigation"],
      id,
      version: "1.0.0",
    }),
  };
}

describe("registry navigation", () => {
  it("adds and removes navigation with its one-line registration", () => {
    const registered = createFeatureRegistry([
      registration("catalog"),
    ]).listNavigation();
    expect(registered).toEqual(navigation);
    expect(Reflect.set(registered, "0", null)).toBe(false);
    expect(createFeatureRegistry([]).listNavigation()).toEqual([]);
  });

  it("rejects navigation destinations owned by multiple features", () => {
    expect(() =>
      createFeatureRegistry([registration("catalog"), registration("search")]),
    ).toThrow("Duplicate navigation destination");
  });
});

import { describe, expect, it } from "vitest";

import type { FeatureRegistration, HomeSection } from "../src/registry.js";
import { createFeatureRegistry } from "../src/registry.js";

const section = (id: string, order: number): HomeSection => ({
  id,
  order,
  render: () => id,
});

// A feature that offers the landing page `sections`, declaring the capability when it says it does.
function feature(
  id: string,
  sections: readonly HomeSection[],
  declares = sections.length > 0,
): FeatureRegistration {
  // A manifest declares at least one capability; the others here say nothing of the landing page.
  const capabilities = declares
    ? (["scheduled-workflows", "home-section"] as const)
    : (["scheduled-workflows"] as const);
  return {
    manifest: {
      capabilities: [...capabilities],
      dependencies: [],
      id,
      navigation: [],
      pages: [],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [],
      version: "1.0.0",
    },
    load: async () => ({
      capabilities: [...capabilities],
      homeSections: sections,
      id,
      version: "1.0.0",
    }),
  };
}

describe("the landing page's sections", () => {
  it("are every feature's own, lowest order first, then by id", async () => {
    const registry = createFeatureRegistry([
      feature("games", [section("games", 20)]),
      feature("collections", [
        section("b-collections", 30),
        section("a-launches", 30),
      ]),
      feature("plain", []),
      feature("first", [section("first", 10)]),
    ]);
    const sections = await registry.listHomeSections();
    expect(sections.map(({ id }) => id)).toEqual([
      "first",
      "games",
      "a-launches",
      "b-collections",
    ]);
    expect(Object.isFrozen(sections)).toBe(true);
  });

  it("are none when no feature offers one", async () => {
    expect(
      await createFeatureRegistry([feature("plain", [])]).listHomeSections(),
    ).toEqual([]);
    expect(await createFeatureRegistry([]).listHomeSections()).toEqual([]);
  });

  it("can be drawn, and the drawing is the feature's", async () => {
    const [only] = await createFeatureRegistry([
      feature("games", [section("games", 1)]),
    ]).listHomeSections();
    expect(await only?.render()).toBe("games");
  });

  it("refuse two sections with one id", async () => {
    const registry = createFeatureRegistry([
      feature("one", [section("same", 1)]),
      feature("two", [section("same", 2)]),
    ]);
    await expect(registry.listHomeSections()).rejects.toThrow(
      "an id of its own",
    );
  });

  it("must match what the manifest says: sections need the capability, and the capability needs sections", async () => {
    await expect(
      createFeatureRegistry([
        feature("quiet", [section("x", 1)], false),
      ]).listHomeSections(),
    ).rejects.toThrow("home sections do not match");
    await expect(
      createFeatureRegistry([
        {
          ...feature("claims", [], true),
          load: async () => ({
            capabilities: ["scheduled-workflows", "home-section"],
            id: "claims",
            version: "1.0.0",
          }),
        },
      ]).listHomeSections(),
    ).rejects.toThrow("home sections do not match");
  });
});

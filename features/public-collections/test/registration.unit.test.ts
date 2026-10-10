import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { describe, expect, it } from "vitest";

import { createPublicCollectionsFeature } from "../src/registration.ts";
import { chains } from "./support/fixtures.ts";

describe("public collections registration", () => {
  it("declares two public pages, one navigation entry, and the storage it signs previews with", () => {
    const { manifest } = createPublicCollectionsFeature(
      createProviderRegistry([]),
      chains,
    );
    const access = { kind: "public" };
    expect(manifest).toMatchObject({
      capabilities: ["navigation", "public-page"],
      dependencies: ["collection-review"],
      id: "collections",
      navigation: [{ access, href: "/collections", label: "Collections" }],
      pages: [
        { access, path: "/collections" },
        { access, path: "/collections/[slug]" },
      ],
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
      routes: [],
    });
  });

  it("loads an entrypoint whose pages match the manifest", async () => {
    const feature = createPublicCollectionsFeature(
      createProviderRegistry([]),
      chains,
    );
    const entrypoint = await feature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["collections"],
    });
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual(
      feature.manifest.pages.map(({ path }) => path),
    );
    expect(entrypoint.operations ?? []).toEqual([]);
  });
});

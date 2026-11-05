import type { FeaturePageContribution } from "@frostbite/plugin-kit";
import { describe, expect, it, vi } from "vitest";

import { declaredMetadata } from "../src/server/metadata/declared";

const shared = {
  description: "d",
  kind: "shared",
  title: "t",
} as const;

function page(
  access: FeaturePageContribution["access"],
  metadata?: FeaturePageContribution["metadata"],
) {
  return {
    page: {
      access,
      path: "/x" as const,
      render: () => null,
      ...(metadata === undefined ? {} : { metadata }),
    },
    params: { slug: "a" },
  };
}

describe("what a page declares for search and previews", () => {
  it("is what a public page declares, given the route's parameters", async () => {
    const declare = vi.fn(async () => shared);
    expect(await declaredMetadata(page({ kind: "public" }, declare))).toEqual(
      shared,
    );
    expect(declare).toHaveBeenCalledWith({ params: { slug: "a" } });
  });

  it("is private for a page behind sign-in, whatever it declares, and it is never even asked", async () => {
    const declare = vi.fn(async () => shared);
    expect(
      await declaredMetadata(page({ kind: "authenticated" }, declare)),
    ).toEqual({ kind: "private" });
    expect(declare).not.toHaveBeenCalled();
  });

  it("is private for a public page that declares nothing, and for no page at all", async () => {
    expect(await declaredMetadata(page({ kind: "public" }))).toEqual({
      kind: "private",
    });
    expect(await declaredMetadata(undefined)).toEqual({ kind: "private" });
  });
});

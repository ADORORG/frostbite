import { ScenesProvider } from "@frostbite/scenes/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The page reads the session cookie to decide which links to show; there is no request here, so the
// visitor has none.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import FeaturePage from "../src/app/[[...path]]/page";

describe("home release state", () => {
  it("does not claim that unimplemented transactions are available", async () => {
    const page = await FeaturePage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(
      <ScenesProvider>{page}</ScenesProvider>,
    );

    // No launch is open, and the launches rail says so rather than showing a sale.
    expect(markup).toContain('id="launches"');
    expect(markup).toContain("Nothing is open to mint right now.");
    expect(markup).not.toMatch(/registered|gated|foundation|Catalog empty/iu);
    // Every feature that has a part of the landing page is on it, games first, because they are what there is to do.
    const order = ["games", "collections", "launches"].map((id) =>
      markup.indexOf(`id="${id}"`),
    );
    expect(order.every((at) => at > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // Features with nothing yet are small tiles, so the page leads with content, not with two empty bands.
    expect(markup).toContain("home-rail--compact");
    expect(markup).toContain("scene-backdrop");
    expect(markup).not.toContain("Connect wallet");
    expect(markup).not.toContain("Buy now");
  });
});

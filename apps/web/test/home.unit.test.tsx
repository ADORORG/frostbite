import { ScenesProvider } from "@ador/scenes/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The page reads the session cookie to decide which links to show; there is no request here, so the
// visitor has none.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { featureRegistry } from "../../../configs/features";
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

    // No launch is published, and the launches rail says so rather than showing a sale.
    expect(markup).toContain('id="launches"');
    expect(markup).toContain("No launch is published");
    expect(markup).toContain("GATED");
    // Every feature that has a part of the landing page is on it, laid out in the order they asked for.
    const order = ["launches", "collections", "games"].map((id) =>
      markup.indexOf(`id="${id}"`),
    );
    expect(order.every((at) => at > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(markup).toContain("scene-backdrop");
    // The count is the registry's own, so adding a feature does not break this test.
    expect(markup).toContain(`${featureRegistry.list().length} REGISTERED`);
    expect(markup).not.toContain("Connect wallet");
    expect(markup).not.toContain("Buy now");
  });
});

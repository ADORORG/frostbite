import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// A visitor: no session cookie.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import FeaturePage from "../src/app/[[...path]]/page";

describe("home navigation", () => {
  it("connects every public and authentication-status surface", async () => {
    const page = await FeaturePage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('href="/launches"');
    expect(markup).toContain('id="launches"');
    expect(markup).toContain('href="/games"');
    expect(markup).toContain('id="games"');
    expect(markup).toContain("Frostbite");
    expect(markup).toContain('href="/collections"');
    expect(markup).toContain('href="/creators"');
    // Signing in is the wallet widget's job (the layout supplies it), not a page or a link of its own.
    expect(markup).not.toContain("/sign-in");
    expect(markup).not.toContain('href="/account"');
    expect(markup).not.toContain('href="/studio"');
    expect(markup).not.toContain('href="/admin"');
  });

  it("rejects a page path that no registered feature owns", async () => {
    await expect(
      FeaturePage({
        params: Promise.resolve({ path: ["missing"] }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

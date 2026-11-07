import { ScenesProvider } from "@frostbite/scenes/react";
import { games } from "@repo/configs/games";
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
    const markup = renderToStaticMarkup(
      <ScenesProvider>{page}</ScenesProvider>,
    );

    expect(markup).toContain('href="/launches"');
    expect(markup).toContain('id="launches"');
    expect(markup).toContain('href="/games"');
    expect(markup).toContain('id="games"');
    // The rail shows the registered games by their own titles (the first one, whichever game that is).
    const [first] = games;
    expect(first).toBeDefined();
    // As the page writes it: a title with an apostrophe or an ampersand is escaped in markup.
    expect(markup).toContain(renderToStaticMarkup(<>{first?.title}</>));
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

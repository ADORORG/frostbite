import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The wallet library needs the app's provider, which the layout supplies; this test renders a page on its own.
vi.mock("@frostbite/wallet/client", () => ({
  useWalletChooser: () => ({ request: () => undefined }),
  useWalletConnection: () => ({
    address: "",
    connected: false,
    network: "signet",
    provider: null,
    signMessage: async () => "",
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import FeaturePage from "../src/app/[[...path]]/page";

// What a redirect throws, in the framework's own form: the kind, how it replaces the page, and where to.
async function redirectOf(path: string): Promise<string> {
  try {
    const page = await FeaturePage({
      params: Promise.resolve({ path: [path] }),
      searchParams: Promise.resolve({}),
    });
    return `rendered: ${renderToStaticMarkup(page)}`;
  } catch (error) {
    return error instanceof Error && "digest" in error
      ? String(error.digest)
      : `failed: ${String(error)}`;
  }
}

describe("protected page delivery", () => {
  it.each(["account", "studio", "admin"])(
    "sends a cookieless /%s request to sign in, and back here afterwards, and shows none of the page",
    async (path) => {
      const outcome = await redirectOf(path);
      expect(outcome).toMatch(/^NEXT_REDIRECT;/u);
      expect(outcome).toContain(
        `/sign-in?returnTo=${encodeURIComponent(`/${path}`)}`,
      );
      // Nothing of the private page is rendered for someone without a session.
      expect(outcome).not.toContain("rendered:");
    },
  );

  it("serves the sign-in page itself to a visitor with no session, with the public navigation and no private areas", async () => {
    const page = await FeaturePage({
      params: Promise.resolve({ path: ["sign-in"] }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);
    expect(markup).toContain("Sign in");
    // The wallet is offered, because the deployment's method registry offers it.
    expect(markup).toContain("Wallet");
    expect(markup).toContain("Checking your session");
    expect(markup).toContain('href="/games"');
    expect(markup).not.toContain('href="/account"');
    expect(markup).not.toContain('href="/studio"');
    expect(markup).not.toContain('href="/admin"');
    expect(markup).not.toContain("Session active");
  });
});

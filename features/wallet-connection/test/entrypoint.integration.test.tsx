import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@ador/wallet/client", async (importOriginal) => {
  const React = await import("react");
  return {
    ...(await importOriginal<typeof import("@ador/wallet/client")>()),
    WalletProvider: ({ children }: { readonly children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useWalletConnection: () => ({
      address: "",
      connect: vi.fn(),
      connected: false,
      connecting: false,
      disconnect: vi.fn(),
      installationUrl: () => "https://example.test/xverse",
      isInstalled: () => true,
      network: "signet",
      provider: null,
    }),
  };
});

import { createWalletConnectionEntrypoint } from "../src/entrypoint.tsx";

describe("wallet connection entrypoint", () => {
  it("renders an honest candidate connection surface", async () => {
    const entrypoint = createWalletConnectionEntrypoint({
      candidates: [{ id: "xverse", label: "Xverse" }],
      network: "signet",
    });
    const page = entrypoint.pages?.[0];
    if (page === undefined) throw new Error("Expected connection page");
    const content = await page.render({
      actorUserId: null,
      navigation: [],
      params: {},
    });
    const html = renderToStaticMarkup(content);
    expect(html).toContain("Connect Xverse");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Choose wallet<\/button>/u,
    );
    expect(html).toContain("Signing in remains disabled");
    expect(html).not.toContain("Sign in");
  });
});

import { createUuidV7 } from "@ador/shared/identifiers";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createAccountsEntrypoint } from "../src/entrypoint.tsx";

// The pages never reach for the wallet services, so a call to them would be a bug.
const noWalletServices = () => {
  throw new Error("The wallet services are not needed to render a page.");
};

// What the sign-in page needs of the platform; the pages tested here do not use it.
const signIn = { network: "signet", offered: () => ["wallet"] } as const;
const withSignIn = (service: Parameters<typeof createAccountsEntrypoint>[2]) =>
  createAccountsEntrypoint(noWalletServices, null, service, signIn);

describe("accounts entrypoint", () => {
  it.each([
    ["/account", "Account console", "Authenticated session"],
    ["/admin", "Admin console", "Staff areas"],
  ])("renders the authorized %s surface", async (path, title, status) => {
    const entrypoint = withSignIn(() => ({
      begin: vi.fn(),
      finish: vi.fn(),
      list: vi.fn(async () => []),
      unlink: vi.fn(),
    }));
    const page = entrypoint.pages?.find((candidate) => candidate.path === path);
    expect(page).toBeDefined();
    const markup = renderToStaticMarkup(
      await page?.render({
        actorUserId: createUuidV7(),
        navigation: [
          {
            area: "admin",
            href: "/admin/collection-reviews",
            label: "Collection reviews",
          },
        ],
        params: {},
      }),
    );
    expect(markup).toContain(title);
    expect(markup).toContain(status);
  });

  it("does not render private content without an actor", async () => {
    const pages =
      withSignIn(() => ({
        begin: vi.fn(),
        finish: vi.fn(),
        list: vi.fn(async () => []),
        unlink: vi.fn(),
      })).pages ?? [];

    // The sign-in page is open to everyone; every other page is private.
    for (const page of pages.filter(({ path }) => path !== "/sign-in")) {
      expect(
        renderToStaticMarkup(
          await page.render({ actorUserId: null, navigation: [], params: {} }),
        ),
      ).toBe("");
    }
  });

  it("fails closed when passkey status persistence is unavailable", async () => {
    const entrypoint = withSignIn(() => ({
      begin: vi.fn(),
      finish: vi.fn(),
      list: vi.fn().mockRejectedValue(new Error("database unavailable")),
      unlink: vi.fn(),
    }));
    const page = entrypoint.pages?.find(({ path }) => path === "/account");
    const markup = renderToStaticMarkup(
      await page?.render({
        actorUserId: createUuidV7(),
        navigation: [],
        params: {},
      }),
    );
    expect(markup).toContain("Passkey status is unavailable");
    expect(markup).not.toContain("Passkey 1");
  });

  it("tells a signed-in player on the account page that the wallet button in the header manages their wallets", async () => {
    const entrypoint = withSignIn(() => ({
      begin: vi.fn(),
      finish: vi.fn(),
      list: vi.fn(async () => []),
      unlink: vi.fn(),
    }));
    const page = entrypoint.pages?.find(({ path }) => path === "/account");
    const markup = renderToStaticMarkup(
      await page?.render({
        actorUserId: createUuidV7(),
        navigation: [],
        params: {},
      }),
    );
    expect(markup).toContain("wallet button in the header");
  });

  it("serves the sign-in page without a session, and says so when no method can be offered", async () => {
    const entrypoint = createAccountsEntrypoint(
      noWalletServices,
      null,
      () => {
        throw new Error("passkeys are not needed to render the sign-in page");
      },
      { network: "signet", offered: () => [] },
    );
    const page = entrypoint.pages?.find(({ path }) => path === "/sign-in");
    expect(page?.access).toEqual({ kind: "public" });
    const markup = renderToStaticMarkup(
      await page?.render({ actorUserId: null, navigation: [], params: {} }),
    );
    expect(markup).toContain("Sign in");
    expect(markup).toContain("Signing in is not available right now.");
  });
});

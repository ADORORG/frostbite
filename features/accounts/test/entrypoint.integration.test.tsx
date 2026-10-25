import type { ContactLinkService } from "@ador/auth";
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
// Nor do they reach for the setup links; the one operation that does is tested on its own.
const noSetupLinks = () => {
  throw new Error("The setup links are not needed to render a page.");
};
const noPasskeySignIn = () => {
  throw new Error("Passkey sign-in is not needed to render a page.");
};
const noEmailSignIn = () => {
  throw new Error("Email sign-in is not needed to render a page.");
};
const noEmailLinks = () => {
  throw new Error("Email links are not needed to render a page.");
};
const withSignIn = (service: Parameters<typeof createAccountsEntrypoint>[6]) =>
  createAccountsEntrypoint(
    noWalletServices,
    null,
    noSetupLinks,
    noPasskeySignIn,
    noEmailSignIn,
    noEmailLinks,
    service,
    signIn,
  );

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

    // The sign-in and setup pages are open to everyone (the person opening a setup link may not be signed in yet); every other page is
    // private.
    const open = ["/sign-in", "/setup"];
    for (const page of pages.filter(({ path }) => !open.includes(path))) {
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
      noSetupLinks,
      noPasskeySignIn,
      noEmailSignIn,
      noEmailLinks,
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

  it("serves the first-time setup page without a session, which signs the visitor in itself and says nothing of any link until it has looked", async () => {
    const entrypoint = withSignIn(() => ({
      begin: vi.fn(),
      finish: vi.fn(),
      list: vi.fn(async () => []),
      unlink: vi.fn(),
    }));
    const page = entrypoint.pages?.find(({ path }) => path === "/setup");
    expect(page?.access).toEqual({ kind: "public" });
    const markup = renderToStaticMarkup(
      await page?.render({ actorUserId: null, navigation: [], params: {} }),
    );
    expect(markup).toContain("First-time setup");
    expect(markup).toContain("Opening your setup link");
    expect(markup).not.toContain("administrator");
  });

  describe("the email panel on the account page", () => {
    // Only `list` is used by the page; the rest of the link service is not.
    const linkService = (
      list: ContactLinkService["list"],
    ): ContactLinkService => ({
      confirm: vi.fn(),
      list,
      request: vi.fn(),
      unlink: vi.fn(),
    });
    const passkeys = () => ({
      begin: vi.fn(),
      finish: vi.fn(),
      list: vi.fn(async () => []),
      unlink: vi.fn(),
    });
    async function accountPage(options: {
      readonly links: () => ContactLinkService;
      readonly offered: readonly string[];
    }) {
      const entrypoint = createAccountsEntrypoint(
        noWalletServices,
        null,
        noSetupLinks,
        noPasskeySignIn,
        noEmailSignIn,
        options.links,
        passkeys,
        { network: "signet", offered: () => options.offered },
      );
      const page = entrypoint.pages?.find(({ path }) => path === "/account");
      return renderToStaticMarkup(
        await page?.render({
          actorUserId: createUuidV7(),
          navigation: [],
          params: {},
        }),
      );
    }

    it("lists the account's addresses where mail is set up", async () => {
      const list = vi.fn(async () => ["a@b.co"]);
      const markup = await accountPage({
        links: () => linkService(list),
        offered: ["wallet", "email"],
      });
      expect(markup).toContain("Email addresses");
      expect(markup).toContain("a@b.co");
      expect(list).toHaveBeenCalledWith(expect.any(String), "email");
    });

    it("shows no panel, and reads nothing, where there is no mail", async () => {
      const list = vi.fn(async () => ["a@b.co"]);
      const markup = await accountPage({
        links: () => linkService(list),
        offered: ["wallet"],
      });
      expect(markup).not.toContain("Email addresses");
      expect(list).not.toHaveBeenCalled();
    });

    it("shows no panel rather than a list it did not read", async () => {
      const markup = await accountPage({
        links: () =>
          linkService(async () => {
            throw new Error("down");
          }),
        offered: ["email"],
      });
      expect(markup).not.toContain("Email addresses");
      expect(markup).toContain("Account console");
    });
  });
});

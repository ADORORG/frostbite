import type { ContactLinkService } from "@ador/auth";
import { createUuidV7 } from "@ador/shared/identifiers";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The account page holds the wallets card, which reads the wallet connection; there is none to read in a page rendered to text.
vi.mock("@ador/wallet/client", () => ({
  useWalletChooser: () => ({ request: () => undefined }),
  useWalletConnection: () => ({
    address: "",
    connected: false,
    network: "signet",
    provider: null,
  }),
}));

import {
  createAccountsEntrypoint,
  type AccountsEntrypointServices,
} from "../src/entrypoint.tsx";

// The pages reach only for what they render; a call to anything else is a bug, so everything is a stand-in that refuses.
const nothing = (what: string) => () => {
  throw new Error(`${what} is not needed to render a page.`);
};
// What the sign-in page needs of the platform; the pages tested here do not use it.
const signIn = { network: "signet", offered: () => ["wallet"] } as const;

function entrypointWith(overrides: Partial<AccountsEntrypointServices> = {}) {
  return createAccountsEntrypoint({
    balanceSource: null,
    emailLinks: nothing("Email links"),
    emailSignIn: nothing("Email sign-in"),
    passkeys: nothing("Passkeys"),
    passkeySignIn: nothing("Passkey sign-in"),
    roles: nothing("The role services"),
    setupLinks: nothing("The setup links"),
    signIn,
    wallet: nothing("The wallet services"),
    ...overrides,
  });
}
const withSignIn = (passkeys: AccountsEntrypointServices["passkeys"]) =>
  entrypointWith({ passkeys });

describe("accounts entrypoint", () => {
  it.each([
    ["/account", "Account", "Signed in"],
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

  it("gives a signed-in player the wallets card on the account page, and says a connected wallet alone does not sign them in", async () => {
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
    expect(markup).toContain("never signs you in by itself");
    expect(markup).toContain("<h2>Wallets</h2>");
    expect(markup).toContain("<h2>Passkeys</h2>");
    expect(markup).toContain("<h2>Account id</h2>");
  });

  it("serves the sign-in page without a session, and says so when no method can be offered", async () => {
    const entrypoint = entrypointWith({
      passkeys: nothing("Passkeys"),
      signIn: { network: "signet", offered: () => [] },
    });
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
      const entrypoint = entrypointWith({
        emailLinks: options.links,
        passkeys,
        signIn: { network: "signet", offered: () => options.offered },
      });
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
      expect(markup).toContain("Account");
    });
  });

  describe("the role screen", () => {
    const page = (entrypoint: ReturnType<typeof entrypointWith>) =>
      entrypoint.pages?.find(({ path }) => path === "/admin/roles");

    it("is for the capability that manages roles, and lists the people who hold them", async () => {
      const holders = vi.fn(async () => [
        {
          label: "ada@example.com",
          roles: [
            {
              effective: true,
              role: "admin" as const,
              status: "active" as const,
            },
          ],
          userId: createUuidV7(),
        },
      ]);
      const entrypoint = entrypointWith({
        roles: () => ({
          administration: { grant: vi.fn(), suspend: vi.fn() },
          directory: { find: vi.fn(), holders },
          recentAuthenticationWindowMs: 600_000,
        }),
      });
      expect(page(entrypoint)?.access).toEqual({
        capability: "platform:manage-roles",
        kind: "platform",
      });
      const markup = renderToStaticMarkup(
        await page(entrypoint)?.render({
          actorUserId: createUuidV7(),
          navigation: [],
          params: {},
        }),
      );
      expect(markup).toContain("Platform roles");
      expect(markup).toContain("ada@example.com");
      expect(holders).toHaveBeenCalledOnce();
    });

    it("shows nothing, and reads nothing, without a session", async () => {
      const entrypoint = entrypointWith();
      expect(
        await page(entrypoint)?.render({
          actorUserId: null,
          navigation: [],
          params: {},
        }),
      ).toBeNull();
    });
  });
});

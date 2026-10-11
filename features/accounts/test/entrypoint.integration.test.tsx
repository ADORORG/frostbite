import { createUuidV7 } from "@ador/shared/identifiers";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createAccountsEntrypoint } from "../src/entrypoint.tsx";

describe("accounts entrypoint", () => {
  it.each([
    ["/account", "Account console", "Authenticated session"],
    ["/admin", "Admin console", "Staff areas"],
  ])("renders the authorized %s surface", async (path, title, status) => {
    const entrypoint = createAccountsEntrypoint(() => ({
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
      createAccountsEntrypoint(() => ({
        begin: vi.fn(),
        finish: vi.fn(),
        list: vi.fn(async () => []),
        unlink: vi.fn(),
      })).pages ?? [];

    for (const page of pages) {
      expect(
        renderToStaticMarkup(
          await page.render({ actorUserId: null, navigation: [], params: {} }),
        ),
      ).toBe("");
    }
  });

  it("fails closed when passkey status persistence is unavailable", async () => {
    const entrypoint = createAccountsEntrypoint(() => ({
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
});

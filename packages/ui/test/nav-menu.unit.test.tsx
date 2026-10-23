import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NavMenu } from "../src/patterns/nav-menu.tsx";
import {
  buildNavigationModel,
  type ShellNavigationItem,
} from "../src/patterns/navigation-model.ts";

const render = (items: readonly ShellNavigationItem[]) =>
  renderToStaticMarkup(<NavMenu model={buildNavigationModel(items)} />);

const everything: readonly ShellNavigationItem[] = [
  { area: "main", href: "/collections", label: "Collections" },
  { area: "main", href: "/games", label: "Games" },
  { area: "studio", href: "/studio", label: "Overview" },
  { area: "admin", href: "/admin", label: "Overview" },
  { area: "account", href: "/account", label: "Account" },
  { area: "account", href: "/connect", label: "Connect" },
];

describe("the narrow-screen menu", () => {
  it("offers every link the bar does, in named groups: the places, the work areas, the account", () => {
    const markup = render(everything);
    for (const href of [
      "/collections",
      "/games",
      "/studio",
      "/admin",
      "/account",
      "/connect",
    ])
      expect(markup).toContain(`href="${href}"`);
    expect(markup).toContain('<p class="menu-group">Work</p>');
    expect(markup).toContain('<p class="menu-group">Account</p>');
    // A work area is one entry, by its name, not by its first page's name.
    expect(markup).toContain(">Studio</a>");
    expect(markup).toContain(">Admin</a>");
  });

  it("is a plain disclosure that works before any script has run", () => {
    const markup = render(everything);
    expect(markup).toContain('<details class="popover nav-menu"');
    expect(markup).toContain("<summary");
  });

  it("names no group it has nothing for", () => {
    const markup = render([
      { area: "main", href: "/collections", label: "Collections" },
    ]);
    expect(markup).not.toContain("menu-group");
  });

  it("marks the page being shown, the area it is in, and the menu itself", () => {
    const markup = render(
      everything.map((item) =>
        item.href === "/studio" ? { ...item, current: "page" as const } : item,
      ),
    );
    expect(markup).toContain('data-current="true">');
    expect(markup).toContain(
      'class="menu-link" data-current="true" href="/studio"',
    );
    const none = render(everything);
    expect(none).not.toContain("data-current");
    expect(none).not.toContain("aria-current");
  });

  it("marks a public or account page as current too", () => {
    const markup = render(
      everything.map((item) =>
        item.href === "/games" ? { ...item, current: "page" as const } : item,
      ),
    );
    expect(markup).toContain(
      'aria-current="page" class="menu-link" data-current="true" href="/games"',
    );
    expect(markup).toContain('class="popover__trigger" data-current="true"');
  });
});

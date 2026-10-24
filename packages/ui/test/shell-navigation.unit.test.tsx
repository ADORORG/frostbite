import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell } from "../src/patterns/app-shell.tsx";
import { Breadcrumbs } from "../src/patterns/breadcrumbs.tsx";
import type { ShellNavigationItem } from "../src/patterns/navigation-model.ts";

function render(navigation: readonly ShellNavigationItem[]) {
  return renderToStaticMarkup(
    <AppShell
      brand="Test"
      footerLabel="Footer"
      homeHref="/"
      navigation={navigation}
    >
      <h1>Page</h1>
    </AppShell>,
  );
}

const visitor: readonly ShellNavigationItem[] = [
  { area: "main", href: "/collections", label: "Collections" },
  { area: "main", href: "/games", label: "Games" },
  { area: "account", href: "/connect", label: "Connect" },
  { area: "footer", href: "/creators", label: "Creators" },
];

const creator: readonly ShellNavigationItem[] = [
  { area: "main", href: "/collections", label: "Collections" },
  { area: "account", href: "/account", label: "Account" },
  { area: "account", href: "/connect", label: "Connect" },
  { area: "studio", href: "/studio", label: "Overview" },
  { area: "studio", href: "/studio/collections", label: "Collections" },
];

describe("shell navigation", () => {
  it("shows a visitor the public links, a single account link, and the footer links", () => {
    const markup = render(visitor);
    expect(markup).toContain('href="/collections"');
    expect(markup).toContain('href="/games"');
    // One account link is not drawn in the bar (the wallet beside it links to the account page); the narrow-screen menu lists it.
    expect(markup).not.toContain("app-nav-link--account");
    expect(markup).toContain(
      '<a class="menu-link" href="/connect">Connect</a>',
    );
    expect(markup).not.toContain("account-menu");
    expect(markup).toContain('aria-label="More"');
    expect(markup).toContain('href="/creators"');
    expect(markup).not.toContain("area-sidebar");
    expect(markup).not.toContain("breadcrumbs");
  });

  it("puts several account links in one menu", () => {
    const markup = render(creator);
    expect(markup).toContain('<details class="popover account-menu"');
    expect(markup).toContain('href="/account"');
    expect(markup).toContain('href="/connect"');
  });

  it("gives each work area one bar entry that opens its first link", () => {
    const markup = render(creator);
    expect(markup).toContain(
      '<a class="app-nav-link" href="/studio">Studio</a>',
    );
    expect(markup).not.toContain("Admin</a>");
  });

  it("shows the area's sidebar, the breadcrumb, and the current link inside a work area", () => {
    const markup = render(
      creator.map((item) =>
        item.href === "/studio/collections"
          ? { ...item, current: "section" as const }
          : item,
      ),
    );
    expect(markup).toContain('aria-label="Studio sections"');
    expect(markup).toContain('data-sidebar="true"');
    expect(markup).toContain('aria-label="Breadcrumb"');
    expect(markup).toContain('<a href="/studio/collections">Collections</a>');
    expect(markup).toContain('data-current="true" href="/studio/collections"');
  });

  it("marks only the work area the person is in as current in the bar", () => {
    const withAdmin: readonly ShellNavigationItem[] = [
      ...creator.map((item) =>
        item.href === "/studio/collections"
          ? { ...item, current: "page" as const }
          : item,
      ),
      { area: "admin", href: "/admin/reviews", label: "Reviews" },
    ];
    const markup = render(withAdmin);
    expect(markup).toContain('data-current="true" href="/studio">Studio');
    expect(markup).toContain(
      '<a class="app-nav-link" href="/admin/reviews">Admin',
    );
  });

  it("marks the page being shown with aria-current, in the sidebar and as the last crumb", () => {
    const markup = render(
      creator.map((item) =>
        item.href === "/studio/collections"
          ? { ...item, current: "page" as const }
          : item,
      ),
    );
    expect(markup).toContain('aria-current="page" class="area-sidebar__link"');
    expect(markup).toContain('<span aria-current="page">Collections</span>');
    expect(markup).toContain('<a href="/studio">Studio</a>');
  });

  it("shows no breadcrumb on an area's first page", () => {
    const markup = render(
      creator.map((item) =>
        item.href === "/studio" ? { ...item, current: "page" as const } : item,
      ),
    );
    expect(markup).toContain('aria-label="Studio sections"');
    expect(markup).not.toContain('aria-label="Breadcrumb"');
  });

  it("keeps the bar entry active but shows no sidebar for an area with a single link", () => {
    const markup = render([
      { area: "main", href: "/collections", label: "Collections" },
      { area: "admin", current: "page", href: "/admin", label: "Overview" },
    ]);
    expect(markup).toContain('data-current="true" href="/admin"');
    expect(markup).not.toContain("area-sidebar");
    expect(markup).not.toContain("data-sidebar");
  });

  it("renders no bar entries and no account link for an empty navigation", () => {
    const markup = render([]);
    expect(markup).not.toContain("app-nav-link");
    expect(markup).toContain("<h1>Page</h1>");
  });

  it("marks a public link as the current page, or only as the section the page sits in", () => {
    const page = render([
      {
        area: "main",
        current: "page",
        href: "/collections",
        label: "Collections",
      },
      { area: "main", href: "/games", label: "Games" },
    ]);
    expect(page).toContain(
      'aria-current="page" class="app-nav-link" data-current="true" href="/collections"',
    );
    expect(page).toContain('<a class="app-nav-link" href="/games">Games</a>');
    const section = render([
      {
        area: "main",
        current: "section",
        href: "/collections",
        label: "Collections",
      },
    ]);
    expect(section).toContain(
      'class="app-nav-link" data-current="true" href="/collections"',
    );
    expect(section).not.toContain("aria-current");
  });

  it("marks the account link, or the account menu and its entry, when the person is on an account page", () => {
    const single = render([
      { area: "account", current: "page", href: "/account", label: "Account" },
    ]);
    expect(single).toContain('aria-current="page"');
    expect(single).toContain('data-current="true" href="/account"');
    const menu = render([
      { area: "account", current: "page", href: "/account", label: "Account" },
      { area: "account", href: "/connect", label: "Connect" },
    ]);
    expect(menu).toContain('data-current="true">Account</summary>');
    expect(menu).toContain(
      '<a aria-current="page" class="menu-link" href="/account">Account</a>',
    );
    expect(menu).toContain('<a class="menu-link" href="/connect">Connect</a>');
    const elsewhere = render([
      { area: "account", href: "/account", label: "Account" },
      { area: "account", href: "/connect", label: "Connect" },
    ]);
    expect(elsewhere).not.toContain("data-current");
    expect(elsewhere).not.toContain("aria-current");
  });
});

describe("breadcrumbs", () => {
  it("names only the last crumb as the page, even when an earlier one has no link", () => {
    const markup = renderToStaticMarkup(
      <Breadcrumbs
        crumbs={[
          { label: "Plain" },
          { href: "/studio", label: "Studio" },
          { label: "Here" },
        ]}
      />,
    );
    expect(markup).toContain("<span>Plain</span>");
    expect(markup).toContain('<span aria-current="page">Here</span>');
    expect(markup).toContain('<a href="/studio">Studio</a>');
    expect(renderToStaticMarkup(<Breadcrumbs crumbs={[]} />)).toBe("");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell } from "../src/patterns/app-shell.tsx";
import type { ShellNavigationItem } from "../src/patterns/navigation-model.ts";

function render(navigation: readonly ShellNavigationItem[]) {
  return renderToStaticMarkup(
    <AppShell
      brand="Test"
      footerLabel="Footer"
      homeHref="/"
      navigation={navigation}
      notices={["Notice"]}
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
    // One account link is shown as itself, not as a menu.
    expect(markup).toContain('href="/connect"');
    expect(markup).not.toContain("<details");
    expect(markup).toContain('aria-label="More"');
    expect(markup).toContain('href="/creators"');
    expect(markup).not.toContain("area-sidebar");
    expect(markup).not.toContain("breadcrumbs");
  });

  it("puts several account links in one menu", () => {
    const markup = render(creator);
    expect(markup).toContain('<details class="account-menu">');
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
});

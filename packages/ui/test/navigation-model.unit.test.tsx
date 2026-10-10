import { describe, expect, it } from "vitest";

import {
  buildNavigationModel,
  type ShellNavigationItem,
} from "../src/patterns/navigation-model.ts";

const items: readonly ShellNavigationItem[] = [
  { area: "main", href: "/collections", label: "Collections" },
  { area: "account", href: "/account", label: "Account" },
  { area: "studio", href: "/studio", label: "Overview" },
  { area: "studio", href: "/studio/collections", label: "Collections" },
  { area: "admin", href: "/admin/collection-reviews", label: "Reviews" },
  { area: "footer", href: "/creators", label: "Creators" },
];

function withCurrent(
  href: string,
  current: "page" | "section",
): readonly ShellNavigationItem[] {
  return items.map((item) =>
    item.href === href ? { ...item, current } : item,
  );
}

describe("navigation model", () => {
  it("groups links by area and keeps each area's own order", () => {
    const model = buildNavigationModel(items);
    expect(model.main.map(({ label }) => label)).toEqual(["Collections"]);
    expect(model.account.map(({ href }) => href)).toEqual(["/account"]);
    expect(model.footer.map(({ href }) => href)).toEqual(["/creators"]);
    expect(model.areas.map(({ label }) => label)).toEqual(["Studio", "Admin"]);
    expect(model.areas[0]?.items.map(({ href }) => href)).toEqual([
      "/studio",
      "/studio/collections",
    ]);
  });

  it("sends an area's entry to the first link the person may see, not a fixed page", () => {
    const model = buildNavigationModel(items);
    // The admin here has no Overview, so the entry opens the reviews rather than a refused page.
    expect(model.areas[1]?.href).toBe("/admin/collection-reviews");
  });

  it("omits an area with no visible links", () => {
    const model = buildNavigationModel(
      items.filter(({ area }) => area !== "admin" && area !== "studio"),
    );
    expect(model.areas).toEqual([]);
    expect(model.active).toBeNull();
    expect(model.breadcrumb).toEqual([]);
  });

  it("has no active area and no breadcrumb on a page outside the work areas", () => {
    const model = buildNavigationModel(withCurrent("/collections", "page"));
    expect(model.active).toBeNull();
    expect(model.breadcrumb).toEqual([]);
  });

  it("has no breadcrumb on the area's first page, though the area is active", () => {
    const model = buildNavigationModel(withCurrent("/studio", "page"));
    expect(model.active?.label).toBe("Studio");
    expect(model.breadcrumb).toEqual([]);
  });

  it("links back to the area on a section's own page", () => {
    const model = buildNavigationModel(
      withCurrent("/studio/collections", "page"),
    );
    expect(model.breadcrumb).toEqual([
      { href: "/studio", label: "Studio" },
      { label: "Collections" },
    ]);
  });

  it("links back to the section and the area from a page inside a section", () => {
    const model = buildNavigationModel(
      withCurrent("/studio/collections", "section"),
    );
    expect(model.breadcrumb).toEqual([
      { href: "/studio", label: "Studio" },
      { href: "/studio/collections", label: "Collections" },
    ]);
  });

  it("keeps a breadcrumb for a page nested under the area's first link", () => {
    // Only the root page itself needs none: a page below it has somewhere to go back to.
    const model = buildNavigationModel(withCurrent("/studio", "section"));
    expect(model.breadcrumb).toEqual([
      { href: "/studio", label: "Studio" },
      { href: "/studio", label: "Overview" },
    ]);
  });
});

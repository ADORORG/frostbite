import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminHome } from "../src/ui/admin-home.tsx";

// The shell around the page lists links of its own, so what the page offers is read from its list alone.
function staffAreas(navigation: Parameters<typeof AdminHome>[0]["navigation"]) {
  const markup = renderToStaticMarkup(<AdminHome navigation={navigation} />);
  return {
    list: /<ul aria-label="Staff areas".*?<\/ul>/.exec(markup)?.[0] ?? null,
    markup,
  };
}

describe("admin home", () => {
  it("offers one way into each staff area the person may open, and not the overview itself", () => {
    const { list } = staffAreas([
      { area: "admin", current: "page", href: "/admin", label: "Overview" },
      {
        area: "admin",
        href: "/admin/collection-reviews",
        label: "Collection reviews",
      },
      {
        area: "admin",
        href: "/admin/creator-applications",
        label: "Creator reviews",
      },
      { area: "studio", href: "/studio", label: "Overview" },
    ]);
    expect(list).not.toBeNull();
    expect(
      [...(list ?? "").matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
    ).toEqual(["/admin/collection-reviews", "/admin/creator-applications"]);
    expect(list).toContain('aria-label="Open Creator reviews"');
  });

  it("says so when no other staff area is open to the person", () => {
    const { list, markup } = staffAreas([
      { area: "admin", current: "page", href: "/admin", label: "Overview" },
    ]);
    expect(list).toBeNull();
    expect(markup).toContain("No staff areas yet");
  });
});

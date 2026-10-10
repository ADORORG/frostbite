import { describe, expect, it, vi } from "vitest";

import {
  markCurrent,
  navigationForAudience,
  navigationForUser,
  type NavigationItem,
} from "../src/navigation.ts";

const navigation = [
  {
    access: { kind: "public" },
    area: "footer",
    href: "/launches",
    label: "Launches",
  },
  {
    access: { kind: "authenticated" },
    area: "studio",
    href: "/studio",
    label: "Overview",
  },
  {
    access: { capability: "platform:operate", kind: "platform" },
    area: "admin",
    href: "/admin",
    label: "Overview",
  },
  {
    access: { capability: "creator:review", kind: "platform" },
    area: "admin",
    href: "/admin/creator-applications",
    label: "Creator reviews",
  },
] as const;

describe("manifest navigation", () => {
  it("reveals only links appropriate for an anonymous audience", () => {
    const items = navigationForAudience(navigation, "public");
    expect(items).toEqual([
      { area: "footer", href: "/launches", label: "Launches" },
    ]);
    expect(Reflect.set(items, "0", null)).toBe(false);
    expect(Reflect.set(items[0] ?? {}, "label", "Changed")).toBe(false);
  });

  it("adds authenticated links without exposing platform links", () => {
    expect(navigationForAudience(navigation, "authenticated")).toEqual([
      { area: "footer", href: "/launches", label: "Launches" },
      { area: "studio", href: "/studio", label: "Overview" },
    ]);
  });

  it("includes only platform links authorized for the exact user, with their areas", async () => {
    const isAllowed = vi.fn(
      async (capability: string) => capability === "creator:review",
    );
    const items = await navigationForUser(navigation, isAllowed);
    expect(items).toEqual([
      { area: "footer", href: "/launches", label: "Launches" },
      { area: "studio", href: "/studio", label: "Overview" },
      {
        area: "admin",
        href: "/admin/creator-applications",
        label: "Creator reviews",
      },
    ]);
    expect(Reflect.set(items, "0", null)).toBe(false);
    expect(Reflect.set(items[0] ?? {}, "label", "Changed")).toBe(false);
    expect(isAllowed).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a capability provider is unavailable", async () => {
    await expect(
      navigationForUser(navigation, async () => {
        throw new Error("authorization unavailable");
      }),
    ).resolves.toEqual([
      { area: "footer", href: "/launches", label: "Launches" },
      { area: "studio", href: "/studio", label: "Overview" },
    ]);
  });
});

describe("link order", () => {
  const link = (label: string, order?: number) =>
    ({
      access: { kind: "public" },
      area: "studio",
      href: `/${label.toLowerCase()}`,
      label,
      ...(order === undefined ? {} : { order }),
    }) as const;
  const labels = (items: readonly { readonly label: string }[]) =>
    items.map(({ label }) => label);

  it("shows links in ascending order, whatever order their features registered in", () => {
    const items = navigationForAudience(
      [link("Late", 30), link("First", 0), link("Middle", 10)],
      "public",
    );
    expect(labels(items)).toEqual(["First", "Middle", "Late"]);
  });

  it("keeps registration order for links in the same position, and puts unordered links at the default", () => {
    const items = navigationForAudience(
      [link("B", 10), link("Plain"), link("A", 10), link("Before", 49)],
      "public",
    );
    // "Plain" has no order, so it sits at the default of 50, after 49.
    expect(labels(items)).toEqual(["B", "A", "Before", "Plain"]);
  });

  it("orders the links a person is allowed to see the same way", async () => {
    const items = await navigationForUser(
      [link("Second", 20), link("First", 10)],
      async () => true,
    );
    expect(labels(items)).toEqual(["First", "Second"]);
  });

  it("does not reorder the manifest's own list", () => {
    const input = [link("Second", 20), link("First", 10)];
    navigationForAudience(input, "public");
    expect(labels(input)).toEqual(["Second", "First"]);
  });
});

describe("marking the current link", () => {
  const items: readonly NavigationItem[] = [
    { area: "studio", href: "/studio", label: "Overview" },
    { area: "studio", href: "/studio/collections", label: "Collections" },
    { area: "main", href: "/collections", label: "Collections" },
  ];
  const currents = (path: string) =>
    markCurrent(items, path).map(({ current }) => current);

  it("marks the exact page as the page", () => {
    expect(currents("/studio/collections")).toEqual([
      undefined,
      "page",
      undefined,
    ]);
  });

  it("marks the longest parent as the section, not a shorter one", () => {
    expect(currents("/studio/collections/abc")).toEqual([
      undefined,
      "section",
      undefined,
    ]);
  });

  it("does not treat a sibling that shares a prefix as a parent", () => {
    // "/collections-archive" starts with "/collections" but is not inside it.
    expect(currents("/collections-archive")).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("marks nothing for a page outside the navigation", () => {
    expect(currents("/connect")).toEqual([undefined, undefined, undefined]);
  });

  it("returns frozen items and leaves the input untouched", () => {
    const marked = markCurrent(items, "/studio");
    expect(Object.isFrozen(marked)).toBe(true);
    expect(Object.isFrozen(marked[0])).toBe(true);
    expect(items[0]?.current).toBeUndefined();
  });
});

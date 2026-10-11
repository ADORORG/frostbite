import type { ActiveSession } from "@ador/auth";
import type { NavigationContribution } from "@ador/shared/features";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import type { PageAccessDependencies } from "../src/server/auth/page-access.ts";
import {
  actorNavigation,
  navigationForSession,
  visitorNavigation,
} from "../src/server/navigation.ts";

const userId = createUuidV7();
const session: ActiveSession = {
  absoluteExpiresAt: new Date("2026-09-10T00:00:00.000Z"),
  authenticatedAt: new Date("2026-09-09T00:00:00.000Z"),
  idleExpiresAt: new Date("2026-09-09T12:00:00.000Z"),
  sessionId: createUuidV7(),
  userId,
};

const contributions: readonly NavigationContribution[] = [
  {
    access: { kind: "public" },
    area: "main",
    href: "/collections",
    label: "Collections",
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
];

function dependencies(input: {
  readonly allowed?: boolean;
  readonly session?: ActiveSession | null;
}): PageAccessDependencies {
  return {
    findSession: vi.fn(async () =>
      input.session === undefined ? session : input.session,
    ),
    forPlatform: vi.fn(async () => ({
      allowed: input.allowed ?? false,
      policyVersion: "test-v1",
    })),
  };
}

const hrefs = (items: readonly { readonly href: string }[]) =>
  items.map(({ href }) => href);

describe("page navigation", () => {
  it("shows a visitor only the public links and marks the current one", () => {
    const items = visitorNavigation(contributions, "/collections/abc");
    expect(hrefs(items)).toEqual(["/collections"]);
    expect(items[0]?.current).toBe("section");
  });

  it("adds the studio for a signed-in person and the admin only when allowed", async () => {
    const plain = await actorNavigation(contributions, "/studio", userId, () =>
      dependencies({ allowed: false }),
    );
    expect(hrefs(plain)).toEqual(["/collections", "/studio"]);
    expect(plain[1]?.current).toBe("page");
    const staff = await actorNavigation(contributions, "/studio", userId, () =>
      dependencies({ allowed: true }),
    );
    expect(hrefs(staff)).toEqual(["/collections", "/studio", "/admin"]);
  });

  it("keeps a signed-in person's links on a public page", async () => {
    const items = await navigationForSession(
      contributions,
      "/collections",
      "token",
      () => dependencies({}),
    );
    expect(hrefs(items)).toEqual(["/collections", "/studio"]);
  });

  it.each([
    { label: "no cookie", token: undefined, deps: dependencies({}) },
    {
      label: "an unknown session",
      token: "stale",
      deps: dependencies({ session: null }),
    },
  ])("shows the visitor's links for $label", async ({ deps, token }) => {
    const items = await navigationForSession(
      contributions,
      "/collections",
      token,
      () => deps,
    );
    expect(hrefs(items)).toEqual(["/collections"]);
  });

  it("falls back to the visitor's links when the session store is down", async () => {
    const failing: PageAccessDependencies = {
      findSession: async () => {
        throw new Error("database unavailable");
      },
      forPlatform: async () => ({ allowed: true, policyVersion: "test-v1" }),
    };
    const items = await navigationForSession(
      contributions,
      "/collections",
      "token",
      () => failing,
    );
    expect(hrefs(items)).toEqual(["/collections"]);
  });
});

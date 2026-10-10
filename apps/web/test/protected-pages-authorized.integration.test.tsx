import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-token" }) }),
}));

vi.mock("../src/server/auth/runtime", () => ({
  getPageAccessDependencies: () => ({
    findSession: async () => ({
      absoluteExpiresAt: new Date("2026-09-10T00:00:00.000Z"),
      authenticatedAt: new Date("2026-09-09T00:00:00.000Z"),
      idleExpiresAt: new Date("2026-09-09T12:00:00.000Z"),
      sessionId: "01992bd8-a740-7000-8000-000000000001",
      userId: "01992bd8-a740-7000-8000-000000000002",
    }),
    forPlatform: async () => ({ allowed: true, policyVersion: "test-v1" }),
  }),
}));

import FeaturePage from "../src/app/[[...path]]/page";

describe("authorized protected page delivery", () => {
  it.each([
    ["account", "Account console", "Session active"],
    ["admin", "Admin console", 'aria-label="Staff areas"'],
  ])("renders the authorized /%s contribution", async (path, heading, own) => {
    const page = await FeaturePage({
      params: Promise.resolve({ path: [path] }),
      searchParams: Promise.resolve({}),
    });

    const markup = renderToStaticMarkup(page);
    expect(markup).toContain(heading);
    expect(markup).toContain(own);
    // The work areas are bar entries; a staff member sees both.
    expect(markup).toContain('href="/studio"');
    expect(markup).toContain('href="/admin"');
    // The account links share one menu.
    expect(markup).toContain('<details class="account-menu">');
    expect(markup).toContain('href="/account"');
  });

  it("shows the admin links in the admin sidebar and not on other pages", async () => {
    const admin = renderToStaticMarkup(
      await FeaturePage({
        params: Promise.resolve({ path: ["admin"] }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(admin).toContain('aria-label="Admin sections"');
    expect(admin).toContain('href="/admin/creator-applications"');
    expect(admin).toContain('href="/admin/collection-reviews"');
    expect(admin).not.toContain('href="/studio/collections"');
    const account = renderToStaticMarkup(
      await FeaturePage({
        params: Promise.resolve({ path: ["account"] }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(account).not.toContain("area-sidebar");
    expect(account).not.toContain('href="/admin/creator-applications"');
  });

  it("shows the studio links in the studio sidebar", async () => {
    const studio = renderToStaticMarkup(
      await FeaturePage({
        params: Promise.resolve({ path: ["studio"] }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(studio).toContain('aria-label="Studio sections"');
    expect(studio).toContain('href="/studio/collections"');
    expect(studio).toContain('href="/studio/uploads"');
    expect(studio).toContain('href="/studio/creator-application"');
  });

  it("keeps a signed-in person's links on a public page", async () => {
    const collections = renderToStaticMarkup(
      await FeaturePage({
        params: Promise.resolve({ path: ["collections"] }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(collections).toContain('href="/studio"');
    expect(collections).toContain('href="/account"');
  });
});

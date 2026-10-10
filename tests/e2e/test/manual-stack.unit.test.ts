import { platformSessionCookieName } from "@ador/shared/auth";
import { describe, expect, it } from "vitest";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import {
  cookieSnippet,
  formatStackGuide,
  resolveStackServer,
  stackActors,
  stackPages,
} from "../src/manual-stack.ts";

describe("manual stack server", () => {
  it("defaults to a port of its own, so it can run beside the test run", () => {
    expect(resolveStackServer({})).toEqual({
      baseURL: "http://localhost:4174",
      port: "4174",
    });
  });

  it("can be moved with STACK_BASE_URL, and refuses a URL without a port", () => {
    expect(
      resolveStackServer({ STACK_BASE_URL: "http://localhost:5000" }).port,
    ).toBe("5000");
    expect(() =>
      resolveStackServer({ STACK_BASE_URL: "http://localhost" }),
    ).toThrow("explicit port");
  });
});

describe("manual stack actors", () => {
  it("are seeded fixtures: every token is a real session token of the test database", () => {
    const seeded = new Set<string>(
      Object.values(creatorE2EFixtures).map(({ sessionToken }) => sessionToken),
    );
    for (const actor of stackActors) expect(seeded.has(actor.token)).toBe(true);
  });

  it("include a reviewer and someone who is not approved, each with a goal in words", () => {
    const labels = stackActors.map(({ label }) => label);
    expect(labels).toContain("Reviewer");
    expect(labels).toContain("Applicant (not approved)");
    expect(new Set(stackActors.map(({ token }) => token)).size).toBe(
      stackActors.length,
    );
    for (const actor of stackActors)
      expect(actor.goal.length).toBeGreaterThan(10);
  });
});

describe("the guide", () => {
  it("makes the session cookie by the platform's own cookie name", () => {
    expect(cookieSnippet("abc")).toBe(
      `document.cookie = "${platformSessionCookieName}=abc; path=/; Secure"`,
    );
  });

  it("says where it runs, how to become each person, and which pages to visit", () => {
    const guide = formatStackGuide({ baseURL: "http://localhost:4174" });
    expect(guide).toContain("running at http://localhost:4174");
    for (const actor of stackActors) {
      expect(guide).toContain(actor.label);
      expect(guide).toContain(cookieSnippet(actor.token));
    }
    for (const [path] of stackPages)
      expect(guide).toContain(`http://localhost:4174${path}`);
    expect(guide).toContain("Ctrl+C");
    expect(guide).toContain("Nothing is on a chain");
  });

  it("uses the actors it is given", () => {
    const guide = formatStackGuide({
      actors: [
        { goal: "Do the only thing here.", label: "Only me", token: "t" },
      ],
      baseURL: "http://localhost:1",
    });
    expect(guide).toContain("Only me");
    expect(guide).not.toContain(creatorE2EFixtures.reviewer.sessionToken);
  });
});

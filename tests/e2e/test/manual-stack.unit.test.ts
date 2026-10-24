import { describe, expect, it } from "vitest";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import {
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

  it("have unique ids and a landing page on this site, so a sign-in lands somewhere real", () => {
    expect(new Set(stackActors.map(({ id }) => id)).size).toBe(
      stackActors.length,
    );
    for (const actor of stackActors) expect(actor.landing).toMatch(/^\/[a-z]/u);
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
  it("says where it runs, how to become each person, and which pages to visit", () => {
    const guide = formatStackGuide({ baseURL: "http://localhost:4174" });
    expect(guide).toContain("running at http://localhost:4174");
    expect(guide).toContain("http://localhost:4174/dev/sign-in");
    for (const actor of stackActors) expect(guide).toContain(actor.label);
    expect(guide).not.toContain("document.cookie");
    for (const [path] of stackPages)
      expect(guide).toContain(`http://localhost:4174${path}`);
    expect(guide).toContain("Ctrl+C");
    expect(guide).toContain("kept in Docker volumes");
    expect(guide).toContain("pnpm stack --fresh");
    expect(guide).toContain("is real: what is sent to it stays there");
    expect(guide).not.toContain("disposable");
  });

  it("uses the actors it is given", () => {
    const guide = formatStackGuide({
      actors: [
        {
          goal: "Do the only thing here.",
          id: "only",
          label: "Only me",
          landing: "/",
          token: "t",
        },
      ],
      baseURL: "http://localhost:1",
    });
    expect(guide).toContain("Only me");
    expect(guide).not.toContain(creatorE2EFixtures.reviewer.sessionToken);
  });
});

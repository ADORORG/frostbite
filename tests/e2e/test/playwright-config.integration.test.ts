import { describe, expect, it } from "vitest";

import config from "../playwright.config.ts";

describe("Playwright production-server integration", () => {
  it("starts the standalone web app on the configured origin", () => {
    expect(config.use?.baseURL).toBe("http://localhost:4173");
    expect(config.webServer).toMatchObject({
      command: "pnpm --filter web start:standalone",
      env: { HOSTNAME: "127.0.0.1", PORT: "4173" },
      url: "http://localhost:4173",
    });
  });

  it("runs the real-service upload flows on the desktop project only", () => {
    const ignores = Object.fromEntries(
      (config.projects ?? []).map(({ name, testIgnore }) => [
        name,
        testIgnore !== undefined,
      ]),
    );
    expect(ignores).toEqual({
      desktop: false,
      mobile: true,
      tablet: true,
      wide: true,
    });
    const pattern = (config.projects ?? []).find(
      ({ testIgnore }) => testIgnore !== undefined,
    )?.testIgnore;
    if (!(pattern instanceof RegExp))
      throw new Error("expected a RegExp ignore pattern");
    expect(String(pattern)).toContain("uploads");
    expect(pattern.test("tests/uploads.spec.ts")).toBe(true);
    expect(pattern.test("tests/uploads-quality.spec.ts")).toBe(false);
  });
});

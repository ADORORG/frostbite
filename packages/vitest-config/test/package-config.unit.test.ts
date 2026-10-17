import { describe, expect, it } from "vitest";

import {
  defaultCoverageThreshold,
  packageVitestConfig,
  domTestTimeoutMs,
  unitTestTimeoutMs,
} from "../src/package-config.ts";

const include = ["src/**/*.ts"];

// `defineConfig` returns the object it is given, so the result is read as plain data.
function build(options: Parameters<typeof packageVitestConfig>[0]) {
  const config = packageVitestConfig(options);
  const test = config.test;
  if (test === undefined) throw new Error("the config has no test section");
  const projects = (test.projects ?? []).flatMap((project) =>
    typeof project === "object" && "test" in project && project.test
      ? [project.test]
      : [],
  );
  return { config, projects, test };
}

describe("packageVitestConfig", () => {
  it("makes a unit and an integration project selected by file name", () => {
    const { projects } = build({ coverage: { include } });
    expect(projects.map(({ name, include: files }) => [name, files])).toEqual([
      ["unit", ["test/**/*.unit.test.ts"]],
      ["integration", ["test/**/*.integration.test.ts"]],
    ]);
  });

  it("measures the given sources with v8 and the default floor on every metric", () => {
    const { test } = build({
      coverage: { exclude: ["src/main.ts"], include },
    });
    expect(test.coverage).toEqual({
      exclude: ["src/main.ts"],
      include,
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        branches: defaultCoverageThreshold,
        functions: defaultCoverageThreshold,
        lines: defaultCoverageThreshold,
        statements: defaultCoverageThreshold,
      },
    });
    expect(defaultCoverageThreshold).toBeGreaterThan(90);
  });

  it("leaves exclude out when none is given and takes a stricter threshold", () => {
    const { test } = build({ coverage: { include, threshold: 100 } });
    expect(test.coverage).not.toHaveProperty("exclude");
    expect(test.coverage?.thresholds).toEqual({
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    });
  });

  it("selects test file suffixes per project", () => {
    const { projects } = build({
      coverage: { include },
      tests: { integration: "tsx", unit: "{ts,tsx}" },
    });
    expect(projects.map(({ include: files }) => files)).toEqual([
      ["test/**/*.unit.test.{ts,tsx}"],
      ["test/**/*.integration.test.tsx"],
    ]);
  });

  it("adds the React plugin and tsconfig paths only when asked", () => {
    const plain = build({ coverage: { include } }).config;
    expect(plain.plugins).toBeUndefined();
    expect(plain.resolve).toBeUndefined();
    const asked = build({
      coverage: { include },
      react: true,
      tsconfigPaths: true,
    }).config;
    expect(asked.plugins).toHaveLength(1);
    expect(asked.resolve).toEqual({ tsconfigPaths: true });
    const declined = build({
      coverage: { include },
      react: false,
      tsconfigPaths: false,
    }).config;
    expect(declined.plugins).toBeUndefined();
    expect(declined.resolve).toBeUndefined();
  });

  it("runs files one at a time only when the package says they share a database", () => {
    expect(build({ coverage: { include } }).test).not.toHaveProperty(
      "fileParallelism",
    );
    expect(
      build({ coverage: { include }, fileParallelism: false }).test
        .fileParallelism,
    ).toBe(false);
  });

  it("gives the integration project a longer timeout than the unit project's", () => {
    const { projects } = build({
      coverage: { include },
      integrationTimeoutMs: 30_000,
    });
    expect(projects.map(({ testTimeout }) => testTimeout)).toEqual([
      unitTestTimeoutMs,
      30_000,
    ]);
  });

  it("sets the environment on the unit and integration projects", () => {
    const { projects } = build({ coverage: { include }, environment: "jsdom" });
    expect(projects.map(({ environment }) => environment)).toEqual([
      "jsdom",
      "jsdom",
    ]);
    expect(
      build({ coverage: { include } }).projects.map(
        ({ environment }) => environment,
      ),
    ).toEqual([undefined, undefined]);
  });

  it("adds a jsdom project for dom tests with its own setup file between the other two", () => {
    const { projects } = build({
      coverage: { include },
      dom: { setupFile: "test/ui-setup.ts" },
    });
    expect(projects.map(({ name }) => name)).toEqual([
      "unit",
      "unit-dom",
      "integration",
    ]);
    expect(projects[1]).toEqual({
      environment: "jsdom",
      include: ["test/**/*.dom.test.{ts,tsx}"],
      name: "unit-dom",
      setupFiles: ["test/ui-setup.ts"],
      // A busy machine renders a page slowly.
      testTimeout: domTestTimeoutMs,
    });
    expect(projects[0]).toMatchObject({
      name: "unit",
      testTimeout: unitTestTimeoutMs,
    });
  });
});

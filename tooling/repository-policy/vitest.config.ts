import { defineConfig } from "vitest/config";

const coverage = {
  provider: "v8" as const,
  reporter: ["text", "json-summary", "lcov"],
  thresholds: {
    branches: 90.01,
    functions: 90.01,
    lines: 90.01,
    statements: 90.01,
  },
  include: ["src/**/*.ts"],
  exclude: ["src/check.ts", "src/check-coverage.ts"],
};

export default defineConfig({
  test: {
    coverage,
    projects: [
      { test: { name: "unit", include: ["test/**/*.unit.test.ts"] } },
      {
        test: {
          name: "integration",
          include: ["test/**/*.integration.test.ts"],
          // This suite parses every workspace source under coverage, alongside Turbo workers.
          // Keep a bounded budget for the full scan, not the unit-test default of five seconds.
          testTimeout: 30_000,
        },
      },
    ],
  },
});

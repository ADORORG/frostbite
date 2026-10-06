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
        },
      },
    ],
  },
});

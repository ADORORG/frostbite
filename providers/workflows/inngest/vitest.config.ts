import { defineConfig } from "vitest/config";

const coverage = {
  provider: "v8" as const,
  reporter: ["text", "json-summary", "lcov"],
  thresholds: {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100,
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

import { defineConfig } from "vitest/config";

const coverage = {
  all: true,
  exclude: ["test/**", "vitest.config.ts", "src/new-game.ts"],
  include: ["src/**/*.ts"],
  provider: "v8" as const,
  reporter: ["text", "json-summary", "lcov"],
  thresholds: {
    branches: 90.01,
    functions: 90.01,
    lines: 90.01,
    statements: 90.01,
  },
};

export default defineConfig({
  test: {
    coverage,
    projects: [
      { test: { include: ["test/**/*.unit.test.ts"], name: "unit" } },
      {
        test: {
          include: ["test/**/*.integration.test.ts"],
          name: "integration",
          testTimeout: 30_000,
        },
      },
    ],
  },
});

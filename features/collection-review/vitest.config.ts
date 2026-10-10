import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration files share one database and each applies the migrations first.
    fileParallelism: false,
    coverage: {
      exclude: ["test/**", "vitest.config.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        branches: 90.01,
        functions: 90.01,
        lines: 90.01,
        statements: 90.01,
      },
    },
    projects: [
      { test: { include: ["test/**/*.unit.test.ts"], name: "unit" } },
      {
        test: {
          include: ["test/**/*.integration.test.ts"],
          name: "integration",
          testTimeout: 15_000,
        },
      },
    ],
  },
});

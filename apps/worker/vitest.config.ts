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
  // The process entry shell; a smoke test runs it as a real process.
  exclude: ["src/main.ts"],
};

export default defineConfig({
  test: {
    coverage,
    // The integration files share one database and each applies migrations, so they run one by one.
    fileParallelism: false,
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

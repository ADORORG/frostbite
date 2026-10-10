import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The pages are server components rendered to markup, so every project runs in node. Integration tests
// run against a real PostgreSQL started by the package script.
export default defineConfig({
  plugins: [react()],
  test: {
    // Integration files share one database and each applies the migrations first.
    fileParallelism: false,
    coverage: {
      exclude: ["test/**", "vitest.config.ts"],
      include: ["src/**/*.{ts,tsx}"],
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
      { test: { include: ["test/**/*.unit.test.{ts,tsx}"], name: "unit" } },
      {
        test: {
          include: ["test/**/*.integration.test.{ts,tsx}"],
          name: "integration",
          testTimeout: 15_000,
        },
      },
    ],
  },
});

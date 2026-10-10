import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Pure logic runs in node; React components run in jsdom. Test files pick their environment by
// suffix: `.unit.test.ts` is node, `.dom.test.ts(x)` is jsdom. Integration tests run against a real
// PostgreSQL started by the package script.
export default defineConfig({
  plugins: [react()],
  test: {
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
      { test: { include: ["test/**/*.unit.test.ts"], name: "unit" } },
      {
        test: {
          environment: "jsdom",
          include: ["test/**/*.dom.test.{ts,tsx}"],
          name: "unit-dom",
          setupFiles: ["test/ui-setup.ts"],
        },
      },
      {
        test: {
          include: ["test/**/*.integration.test.ts"],
          name: "integration",
        },
      },
    ],
  },
});

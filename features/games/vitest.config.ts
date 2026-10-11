import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    coverage: {
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
    environment: "node",
    projects: [
      { test: { include: ["test/**/*.unit.test.{ts,tsx}"], name: "unit" } },
      {
        test: {
          include: ["test/**/*.integration.test.{ts,tsx}"],
          name: "integration",
        },
      },
    ],
  },
});

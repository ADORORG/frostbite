import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The hooks run in jsdom. The integration project exists for the workspace contract and holds the
// tests that drive the hooks through a real browser-side requester against a real socket.
export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      exclude: ["test/**", "vitest.config.ts", "src/index.ts"],
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
    environment: "jsdom",
    projects: [
      {
        plugins: [react()],
        test: {
          environment: "jsdom",
          include: ["test/**/*.unit.test.{ts,tsx}"],
          name: "unit",
          setupFiles: ["test/ui-setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          environment: "jsdom",
          include: ["test/**/*.integration.test.{ts,tsx}"],
          name: "integration",
          setupFiles: ["test/ui-setup.ts"],
        },
      },
    ],
  },
});

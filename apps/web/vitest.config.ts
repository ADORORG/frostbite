import react from "@vitejs/plugin-react";
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
  include: [
    "src/app/**/page.tsx",
    "src/client-navigation.ts",
    "src/app/api/v1/**/route.ts",
    "src/server/http/next-operation.ts",
    "src/server/auth/page-access.ts",
    "src/server/auth/runtime.ts",
    "src/app/api/csp-report/route.ts",
    "src/app/api/ready/route.ts",
    "src/proxy.ts",
    "src/server/database.ts",
    "src/server/rate-limit.ts",
    "src/server/readiness.ts",
    "src/server/security/*.ts",
  ],
};

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    coverage,
    environment: "node",
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/**/*.unit.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/**/*.integration.test.{ts,tsx}"],
        },
      },
    ],
  },
});

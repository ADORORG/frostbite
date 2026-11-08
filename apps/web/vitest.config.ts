import {
  databaseTestTimeoutMs,
  packageVitestConfig,
} from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    include: [
      "src/app/**/page.tsx",
      "src/app/robots.ts",
      "src/app/sitemap.ts",
      "src/app/**/share-image/route.tsx",
      "src/server/metadata/*.ts*",
      "src/client-navigation.ts",
      "src/instrumentation.ts",
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
  },
  environment: "node",
  // The integration tests run against PostgreSQL, so they get the same allowance as every other database-backed package.
  integrationTimeoutMs: databaseTestTimeoutMs,
  react: true,
  tsconfigPaths: true,
  tests: { integration: "{ts,tsx}", unit: "{ts,tsx}" },
});

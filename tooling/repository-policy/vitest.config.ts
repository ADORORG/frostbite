import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    exclude: ["src/check.ts", "src/check-coverage.ts", "src/ci-local.ts"],
    include: ["src/**/*.ts"],
  },
  // The integration suite parses every workspace source under coverage, alongside Turbo workers,
  // so it needs a bounded budget for the full scan rather than the default of five seconds.
  integrationTimeoutMs: 30_000,
});

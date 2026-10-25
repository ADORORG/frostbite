import {
  databaseTestTimeoutMs,
  packageVitestConfig,
} from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // The command line only reads the settings file and the process environment, then hands them to `link.ts` and `services.ts`,
    // which are tested.
    exclude: ["test/**", "vitest.config.ts", "src/cli.ts"],
    include: ["src/**/*.ts"],
  },
  fileParallelism: false,
  integrationTimeoutMs: databaseTestTimeoutMs,
});

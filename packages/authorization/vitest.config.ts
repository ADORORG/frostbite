import {
  databaseTestTimeoutMs,
  packageVitestConfig,
} from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    exclude: ["test/**", "vitest.config.ts", "src/index.ts"],
    include: ["src/**/*.ts"],
  },
  fileParallelism: false,
  integrationTimeoutMs: databaseTestTimeoutMs,
});

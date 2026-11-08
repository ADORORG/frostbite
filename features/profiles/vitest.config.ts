import {
  databaseTestTimeoutMs,
  packageVitestConfig,
} from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    exclude: ["test/**", "vitest.config.ts"],
    include: ["src/**/*.{ts,tsx}"],
  },
  dom: { setupFile: "test/ui-setup.ts" },
  // The integration files share one database.
  fileParallelism: false,
  integrationTimeoutMs: databaseTestTimeoutMs,
  react: true,
});

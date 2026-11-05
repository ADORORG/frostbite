import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // `cli.ts` only reads the command line and prints; what it calls is tested.
    exclude: ["test/**", "vitest.config.ts", "src/cli.ts"],
    include: ["src/**/*.ts"],
  },
  integrationTimeoutMs: 30_000,
});

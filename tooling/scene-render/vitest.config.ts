import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // The command line only reads its arguments and hands them to `render.ts`, which is tested against the real encoder.
    exclude: ["test/**", "vitest.config.ts", "src/cli.ts"],
    include: ["src/**/*.ts"],
  },
  integrationTimeoutMs: 60_000,
});

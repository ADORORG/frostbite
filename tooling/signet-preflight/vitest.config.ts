import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // The command line only reads files and the process environment, then hands them to `run.ts`, which is tested.
    exclude: ["test/**", "vitest.config.ts", "src/cli.ts"],
    include: ["src/**/*.ts"],
  },
});

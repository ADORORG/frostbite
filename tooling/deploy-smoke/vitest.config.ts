import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // The command line only reads its argument and prints what `run-smoke.ts` returns.
    exclude: ["test/**", "vitest.config.ts", "src/cli.ts"],
    include: ["src/**/*.ts"],
  },
});

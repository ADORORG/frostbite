import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // The command line and the process/docker control are exercised by `pnpm regtest:*`, not by unit tests.
    exclude: ["**/test/**", "vitest.config.ts", "src/cli.ts", "src/stack.ts"],
    include: ["src/**/*.ts"],
  },
});

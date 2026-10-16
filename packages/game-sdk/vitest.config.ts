import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // The command's entry shell: a smoke test runs it as a real process (test/dev-host-bin.integration.test.ts).
    exclude: ["src/dev-host/bin.ts"],
    include: ["src/**/*.ts"],
  },
});

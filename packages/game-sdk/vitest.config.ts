import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // The commands' entry shells: a smoke test runs each as a real process (test/dev-host-bin.integration.test.ts, test/skill-bin.integration.test.ts).
    exclude: ["src/dev-host/bin.ts", "src/skill/bin.ts"],
    include: ["src/**/*.ts"],
  },
});

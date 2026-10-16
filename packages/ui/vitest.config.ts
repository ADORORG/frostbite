import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { include: ["src/**/*.tsx"] },
  tests: { integration: "tsx", unit: "tsx" },
});

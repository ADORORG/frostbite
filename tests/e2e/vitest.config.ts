import {
  containerTestTimeoutMs,
  packageVitestConfig,
} from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { include: ["src/**/*.ts"] },
  integrationTimeoutMs: containerTestTimeoutMs,
});

import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { include: ["src/probes.ts"] },
});

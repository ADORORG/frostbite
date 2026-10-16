import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { exclude: ["src/worker.ts"], include: ["src/**/*.ts"] },
});

import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { include: ["src/**/*.ts"], threshold: 100 },
});

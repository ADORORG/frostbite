import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { include: ["src/**/*.{ts,tsx}"] },
  tests: { integration: "{ts,tsx}", unit: "{ts,tsx}" },
});

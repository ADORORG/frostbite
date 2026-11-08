import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: { include: ["src/**/*.{ts,tsx}"] },
  environment: "node",
  react: true,
  tsconfigPaths: true,
  tests: { integration: "{ts,tsx}", unit: "{ts,tsx}" },
});

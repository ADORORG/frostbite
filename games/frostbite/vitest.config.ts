import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    include: [
      "src/platform/**/*.ts",
      "src/verifier/**/*.ts",
      "src/ice-field/**/*.{ts,tsx}",
      "src/cabinet/**/*.{ts,tsx}",
      "src/snake/**/*.{ts,tsx}",
    ],
  },
  tests: { integration: "{ts,tsx}", unit: "{ts,tsx}" },
});

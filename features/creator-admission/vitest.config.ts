import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    exclude: ["test/**", "vitest.config.ts"],
    include: ["src/**/*.{ts,tsx}"],
  },
  environment: "jsdom",
  react: true,
  tests: { integration: "{ts,tsx}", unit: "{ts,tsx}" },
});

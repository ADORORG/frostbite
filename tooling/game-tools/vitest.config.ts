import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    exclude: [
      "test/**",
      "vitest.config.ts",
      "src/new-game.ts",
      "src/dev-game.ts",
    ],
    include: ["src/**/*.ts"],
  },
  integrationTimeoutMs: 30_000,
});

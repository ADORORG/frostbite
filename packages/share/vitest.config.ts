import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    exclude: ["test/**", "vitest.config.ts", "src/index.ts"],
    include: ["src/**/*.{ts,tsx}"],
  },
  dom: { setupFile: "test/ui-setup.ts" },
  react: true,
});

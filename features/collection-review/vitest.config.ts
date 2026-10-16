import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    exclude: ["test/**", "vitest.config.ts"],
    include: ["src/**/*.{ts,tsx}"],
  },
  dom: { setupFile: "test/ui-setup.ts" },
  fileParallelism: false,
  react: true,
});

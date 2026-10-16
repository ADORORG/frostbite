import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  // src/main.ts is the process entry shell; a smoke test runs it as a real process.
  coverage: { exclude: ["src/main.ts"], include: ["src/**/*.ts"] },
  fileParallelism: false,
});

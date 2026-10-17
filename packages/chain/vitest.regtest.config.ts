import { defineConfig } from "vitest/config";

// Runs against the local regtest stack (tooling/regtest), which must be up: there is no skipping here, so a missing stack fails.
export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["regtest/**/*.regtest.test.ts"],
    testTimeout: 180_000,
  },
});

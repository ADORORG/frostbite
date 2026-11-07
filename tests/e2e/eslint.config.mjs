import { config } from "@repo/eslint-config/base";

// The browser tests write their report and traces here; they are generated, not source.
export default [
  { ignores: ["playwright-report/**", "test-results/**"] },
  ...config,
];

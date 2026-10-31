import { packageVitestConfig } from "@repo/vitest-config";

export default packageVitestConfig({
  coverage: {
    // `main.ts` joins the page to the platform and is run (bundled) against a simulated platform by the integration tests, which this
    // report does not instrument; `replay.ts` is the verifier's entry, run by the platform's own conformance and replay tests.
    exclude: ["src/main.ts", "src/replay.ts"],
    include: ["src/**/*.ts"],
  },
  integrationTimeoutMs: 40_000,
});

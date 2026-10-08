import { parseR2Environment } from "../src/config.ts";
import { createR2ObjectStorage } from "../src/create-adapter.ts";
import { runStorageSmoke } from "./smoke-checks.ts";

// Verifies a real R2 (or any S3-compatible) deployment with the configured credentials. It writes one
// throwaway object, reads it back every supported way, and deletes it. Run it with the same
// environment the application will use: `pnpm --filter @ador/provider-object-storage-r2 smoke`.
const environment = process.env;
const config = parseR2Environment(environment);
const publicBaseUrl = environment.PUBLIC_BASE_URL;
if (!publicBaseUrl)
  throw new Error(
    "PUBLIC_BASE_URL is required: its origin is the one the bucket CORS rule must allow.",
  );
const webOrigin = new URL(publicBaseUrl).origin;
const results = await runStorageSmoke(createR2ObjectStorage(config), webOrigin);
for (const { detail, name, ok } of results)
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
const failed = results.filter(({ ok }) => !ok).length;
console.log(
  failed === 0
    ? "All storage checks passed."
    : `${failed} storage check(s) failed.`,
);
process.exitCode = failed === 0 ? 0 : 1;

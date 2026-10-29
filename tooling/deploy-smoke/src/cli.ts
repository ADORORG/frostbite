import { parseBaseUrl } from "./base-url.ts";
import { runSmoke } from "./run-smoke.ts";

// pnpm smoke <origin> [--timeout-ms <n>]
const timeoutFlag = process.argv.indexOf("--timeout-ms");
const timeoutMs =
  timeoutFlag < 0 ? 10_000 : Number(process.argv[timeoutFlag + 1]);
const target = process.argv[2];
if (target === undefined || !Number.isInteger(timeoutMs) || timeoutMs <= 0) {
  console.error("Usage: pnpm smoke <origin> [--timeout-ms <milliseconds>]");
  process.exit(2);
}
let base: URL;
try {
  base = parseBaseUrl(target);
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : "Bad address.");
  process.exit(2);
}
const results = await runSmoke(base, { timeoutMs });
for (const { detail, name, ok } of results)
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` -- ${detail}`}`);
const failed = results.filter(({ ok }) => !ok).length;
console.log(
  failed === 0
    ? "\nAll checks passed."
    : `\n${String(failed)} of ${String(results.length)} checks failed.`,
);
process.exit(failed === 0 ? 0 : 1);

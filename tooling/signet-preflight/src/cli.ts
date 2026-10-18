import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";

import { exitCodeOf, formatReport } from "./result.ts";
import { runPreflight } from "./run.ts";

// `pnpm signet:preflight [--env <file>]`: checks, without sending anything, what a first signet run needs.
const root = resolve(import.meta.dirname, "../../..");
const { values } = parseArgs({ options: { env: { type: "string" } } });
const file = resolve(root, values.env ?? "apps/web/.env.local");
let fromFile: NodeJS.ProcessEnv = {};
try {
  // The app reads a relative templates directory from where it runs, so the check does too.
  process.chdir(dirname(file));
  fromFile = parseEnv(readFileSync(file, "utf8"));
} catch {
  console.error(
    `No settings file at ${file}; reading the process environment only.`,
  );
}
const results = await runPreflight(
  { ...fromFile, ...process.env },
  {
    fetch: (url, init) => fetch(url, init),
    readFile: async (path) => new Uint8Array(await readFile(path)),
  },
);
console.log(formatReport(results));
process.exit(exitCodeOf(results));

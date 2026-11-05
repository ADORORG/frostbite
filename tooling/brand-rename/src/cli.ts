import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { findRemaining, runRename, type Remaining } from "./rename.ts";

// `pnpm rename:brand --scope @name --slug name --name Name [--dry-run]` rewrites the old name; `pnpm rename:brand --check` only looks for it.
const { values } = parseArgs({
  options: {
    check: { type: "boolean" },
    "dry-run": { type: "boolean" },
    name: { type: "string" },
    scope: { type: "string" },
    slug: { type: "string" },
  },
});
const root = resolve(import.meta.dirname, "../../..");

function show(remaining: readonly Remaining[]): void {
  for (const { file, line, text } of remaining.slice(0, 60))
    console.log(`  ${file}:${String(line)}  ${text}`);
  if (remaining.length > 60)
    console.log(`  ... and ${String(remaining.length - 60)} more`);
}

if (values.check === true) {
  const remaining = await findRemaining({ root });
  if (remaining.length === 0)
    console.log("The old name is nowhere in the repository.");
  else {
    console.log(
      `The old name still stands in ${String(remaining.length)} places:`,
    );
    show(remaining);
    process.exit(1);
  }
} else {
  const { name, scope, slug } = values;
  if (name === undefined || scope === undefined || slug === undefined) {
    console.error(
      "Usage: pnpm rename:brand --scope @name --slug name --name Name [--dry-run]   or   pnpm rename:brand --check",
    );
    process.exit(2);
  }
  const dryRun = values["dry-run"] === true;
  const report = await runRename({
    brand: { display: name, scope, slug },
    dryRun,
    root,
  });
  console.log(
    `${dryRun ? "Would change" : "Changed"} ${String(report.changed.length)} files.`,
  );
  for (const [rule, count] of Object.entries(report.counts))
    console.log(`  ${rule}: ${String(count)}`);
  console.log(
    `Left alone: ${String(report.excluded)} generated or historical files, ${String(report.binary)} that are not text.`,
  );
  if (report.remaining.length > 0) {
    console.log(
      `The old name still stands in ${String(report.remaining.length)} places:`,
    );
    show(report.remaining);
    process.exit(1);
  }
}

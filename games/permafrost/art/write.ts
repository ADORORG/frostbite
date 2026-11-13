import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { drawingIds, drawingOf } from "./index.ts";

// `pnpm --filter @game/permafrost art` writes the drawing of every milestone into `milestone-art/`, one file named for the milestone, which is
// what the staff page's "Define many milestones" takes. The test keeps these files the same as what is generated here.
const directory = join(import.meta.dirname, "../milestone-art");
mkdirSync(directory, { recursive: true });
for (const id of drawingIds)
  writeFileSync(join(directory, `${id}.svg`), `${drawingOf(id) ?? ""}\n`);
console.log(`Wrote ${String(drawingIds.length)} drawings to ${directory}`);

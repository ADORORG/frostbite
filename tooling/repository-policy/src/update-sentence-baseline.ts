import { writeFile } from "node:fs/promises";

import { listSourceFiles } from "./files.ts";
import { baselineOf, readProductionSources } from "./sentence-policy.ts";
import { sentenceBaselinePath } from "./sentence-baseline.ts";
import { repositoryRoot } from "./workspaces.ts";

// Rewrites the baseline to exactly today's duplicates. Run it after removing duplicates, so the baseline shrinks with them; the check
// refuses a baseline that allows more than there is.
const root = repositoryRoot(import.meta.url);
const sources = await readProductionSources(root, await listSourceFiles(root));
await writeFile(
  sentenceBaselinePath(root),
  `${JSON.stringify(baselineOf(sources), null, 2)}\n`,
);
console.log("The sentence baseline was rewritten.");

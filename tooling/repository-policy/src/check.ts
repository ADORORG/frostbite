import { collectViolations } from "./collect-violations.ts";
import { repositoryRoot } from "./workspaces.ts";

const { fileCount, violations, workspaceCount } = await collectViolations(
  repositoryRoot(import.meta.url),
);

if (violations.length > 0) {
  throw new Error(
    `Repository policy violations:\n- ${violations.join("\n- ")}`,
  );
}

console.log(
  `Repository policies passed for ${workspaceCount} workspaces and ${fileCount} files.`,
);

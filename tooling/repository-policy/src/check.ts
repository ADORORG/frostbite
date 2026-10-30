import { findBoundaryViolations } from "./boundary-policy.ts";
import { listSourceFiles } from "./files.ts";
import { findOversizedFiles } from "./line-policy.ts";
import { findReadmeViolations } from "./readme-policy.ts";
import { readSentenceBaseline } from "./sentence-baseline.ts";
import {
  findDuplicateSentences,
  readProductionSources,
} from "./sentence-policy.ts";
import { findScriptPolicyViolations } from "./script-policy.ts";
import { findSkillViolations } from "./skill-policy.ts";
import { findTemplateReleaseViolations } from "./template-release-policy.ts";
import { discoverWorkspaces, repositoryRoot } from "./workspaces.ts";

const root = repositoryRoot(import.meta.url);
const workspaces = await discoverWorkspaces(root);
const files = await listSourceFiles(root);
const violations = [
  ...findScriptPolicyViolations(workspaces),
  ...(await findReadmeViolations(workspaces)),
  ...(await findSkillViolations(root)),
  ...(await findOversizedFiles(root, files)),
  ...(await findBoundaryViolations(root, files)),
  ...findDuplicateSentences(
    await readProductionSources(root, files),
    await readSentenceBaseline(root),
  ),
  ...(await findTemplateReleaseViolations(root)),
];

if (violations.length > 0) {
  throw new Error(
    `Repository policy violations:\n- ${violations.join("\n- ")}`,
  );
}

console.log(
  `Repository policies passed for ${workspaces.length} workspaces and ${files.length} files.`,
);

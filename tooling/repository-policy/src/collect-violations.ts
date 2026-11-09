import { findBoundaryViolations } from "./boundary-policy.ts";
import { listSourceFiles } from "./files.ts";
import { findDeepRelativeImports } from "./import-policy.ts";
import { findLicenseViolations } from "./license-policy.ts";
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
import {
  findCoverageUploadViolations,
  readCiWorkflow,
} from "./workflow-policy.ts";
import { discoverWorkspaces } from "./workspaces.ts";

interface RepositoryReport {
  readonly fileCount: number;
  readonly violations: readonly string[];
  readonly workspaceCount: number;
}

// Every static policy `pnpm repository:check` enforces, run over the repository at `root`. This is the one list of them: a policy that is
// not called here is not enforced, so the tests run it against a repository that breaks each policy in turn.
export async function collectViolations(
  root: string,
): Promise<RepositoryReport> {
  const workspaces = await discoverWorkspaces(root);
  const files = await listSourceFiles(root);
  const violations = [
    ...findScriptPolicyViolations(workspaces),
    ...(await findReadmeViolations(workspaces)),
    ...(await findSkillViolations(root)),
    ...(await findOversizedFiles(root, files)),
    ...(await findDeepRelativeImports(root, files)),
    ...(await findBoundaryViolations(root, files)),
    ...findDuplicateSentences(
      await readProductionSources(root, files),
      await readSentenceBaseline(root),
    ),
    ...(await findTemplateReleaseViolations(root)),
    ...(await findLicenseViolations(root, workspaces)),
    ...findCoverageUploadViolations(
      root,
      workspaces,
      await readCiWorkflow(root),
    ),
  ];
  return {
    fileCount: files.length,
    violations,
    workspaceCount: workspaces.length,
  };
}

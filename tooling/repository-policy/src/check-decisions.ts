import { decisionCatalog } from "@repo/configs/decision-gates";

import { findDecisionPolicyViolations } from "./decision-policy.ts";
import { repositoryRoot } from "./workspaces.ts";

const root = repositoryRoot(import.meta.url);
const violations = await findDecisionPolicyViolations(root, decisionCatalog);

if (violations.length > 0) {
  throw new Error(`Decision policy violations:\n- ${violations.join("\n- ")}`);
}

console.log("Decision catalog and generated reference are valid.");

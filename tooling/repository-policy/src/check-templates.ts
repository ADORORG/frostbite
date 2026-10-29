import { findTemplateReleaseViolations } from "./template-release-policy.ts";
import { repositoryRoot } from "./workspaces.ts";

// Run by the container build, so an image can only carry the released templates.
const violations = await findTemplateReleaseViolations(
  repositoryRoot(import.meta.url),
);
if (violations.length > 0)
  throw new Error(`Template release violations:\n- ${violations.join("\n- ")}`);
console.log("The released templates match release.json.");

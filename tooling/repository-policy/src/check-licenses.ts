import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  findDependencyLicenseViolations,
  licenseReportSchema,
} from "./dependency-licenses.ts";
import { repositoryRoot } from "./workspaces.ts";

// Reads the licences of the production dependencies from the install itself (`pnpm licenses`), so no extra tool has to be trusted, and fails
// on one the policy does not allow. It reads the lockfile's installed packages, so it needs `pnpm install` to have run.
const { stdout } = await promisify(execFile)(
  "pnpm",
  ["licenses", "list", "--prod", "--json"],
  { cwd: repositoryRoot(import.meta.url), maxBuffer: 64 * 1024 * 1024 },
);
const report = licenseReportSchema.parse(JSON.parse(stdout));
const violations = findDependencyLicenseViolations(report);

if (violations.length > 0)
  throw new Error(
    `Dependency licence violations:\n- ${violations.join("\n- ")}`,
  );

console.log(
  `Dependency licences passed: ${String(Object.values(report).flat().length)} packages under ${String(Object.keys(report).length)} licences.`,
);

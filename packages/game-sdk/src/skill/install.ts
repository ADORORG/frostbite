import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import { hasSkillBlock, skillBlock, withSkillBlock } from "./agents-block.ts";
import { digestsOf, listFiles, writeInto } from "./files.ts";

// The skill is installed where Claude Code looks for a project's skills, under the name its SKILL.md gives it.
export const skillName = "build-a-game";
export const skillsFolder = ".claude/skills";
export const agentsFile = "AGENTS.md";
// Written beside the installed files: what was installed and from which SDK, so a later run can tell a stale copy from a local edit.
export const markerFile = ".installed.json";

const markerSchema = z.object({
  files: z.record(z.string(), z.string()),
  sdk: z.string(),
  version: z.string(),
});
type Marker = z.infer<typeof markerSchema>;

export interface SkillSource {
  // The folder holding SKILL.md and its references.
  readonly directory: string;
  // The SDK's own package name and version.
  readonly sdk: string;
  readonly version: string;
}

export type SkillState =
  | { readonly kind: "missing" }
  | { readonly kind: "current"; readonly agents: boolean }
  // Installed files differ from what the marker recorded: someone edited them.
  | { readonly kind: "modified"; readonly files: readonly string[] }
  // Installed files are as recorded, but the SDK now ships something else.
  | {
      readonly kind: "outdated";
      readonly installed: string;
      readonly shipped: string;
    };

const skillPathIn = (project: string): string =>
  join(project, skillsFolder, skillName);

async function readMarker(directory: string): Promise<Marker | null> {
  try {
    return markerSchema.parse(
      JSON.parse(await readFile(join(directory, markerFile), "utf8")),
    );
  } catch {
    return null;
  }
}

async function readAgents(project: string): Promise<string | null> {
  try {
    return await readFile(join(project, agentsFile), "utf8");
  } catch {
    return null;
  }
}

function differing(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): string[] {
  const paths = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...paths].filter((path) => left[path] !== right[path]).sort();
}

export async function skillState(
  project: string,
  source: SkillSource,
): Promise<SkillState> {
  const directory = skillPathIn(project);
  const marker = await readMarker(directory);
  if (marker === null) return { kind: "missing" };
  const present = Object.fromEntries(
    Object.entries(await digestsOf(directory)).filter(
      ([path]) => path !== markerFile,
    ),
  );
  const edited = differing(marker.files, present);
  if (edited.length > 0) return { files: edited, kind: "modified" };
  const shipped = await digestsOf(source.directory);
  if (differing(marker.files, shipped).length > 0)
    return {
      installed: marker.version,
      kind: "outdated",
      shipped: source.version,
    };
  const agents = await readAgents(project);
  return {
    agents: agents !== null && hasSkillBlock(agents),
    kind: "current",
  };
}

export type InstallResult =
  | { readonly kind: "installed" | "updated"; readonly files: number }
  | { readonly kind: "unchanged" }
  | { readonly kind: "kept"; readonly files: readonly string[] };

// Copies the skill into the project and points AGENTS.md at it. A copy someone has edited is kept unless `force` says to replace it.
export async function installSkill(input: {
  readonly agents: boolean;
  readonly force: boolean;
  readonly project: string;
  readonly source: SkillSource;
}): Promise<InstallResult> {
  const { project, source } = input;
  if (!(await listFiles(source.directory)).includes("SKILL.md"))
    throw new Error(`${source.directory} has no SKILL.md.`);
  const before = await skillState(project, source);
  if (before.kind === "modified" && !input.force)
    return { files: before.files, kind: "kept" };
  const directory = skillPathIn(project);
  await rm(directory, { force: true, recursive: true });
  await mkdir(directory, { recursive: true });
  const files = await digestsOf(source.directory);
  for (const path of Object.keys(files))
    await writeInto(
      directory,
      path,
      await readFile(join(source.directory, path)),
    );
  const marker: Marker = { files, sdk: source.sdk, version: source.version };
  await writeInto(
    directory,
    markerFile,
    `${JSON.stringify(marker, null, 2)}\n`,
  );
  if (input.agents) {
    const block = skillBlock({
      sdk: source.sdk,
      skillPath: `${skillsFolder}/${skillName}/SKILL.md`,
    });
    await writeInto(
      project,
      agentsFile,
      withSkillBlock((await readAgents(project)) ?? "", block),
    );
  }
  const count = Object.keys(files).length;
  if (before.kind === "missing") return { files: count, kind: "installed" };
  return before.kind === "current"
    ? { kind: "unchanged" }
    : { files: count, kind: "updated" };
}

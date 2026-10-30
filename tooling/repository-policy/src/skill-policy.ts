import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { z } from "zod";

// The AI skills the repository ships (`skills/<name>/`) are read by an agent that cannot ask what a line meant, so what they say must stay
// true: the front matter is what an agent loads, every reference is linked from SKILL.md and exists, every repository path and root script
// they name exists (a path with a `<placeholder>` in it is a pattern, not a file), and none of them hard-codes the platform's name (the SDK's package name is looked up, so a rename cannot leave a skill stale).
export const maximumSkillLines = 500;
export const maximumDescription = 1024;
const pnpmBuiltins = new Set(["add", "dlx", "exec", "install", "run"]);
const repositoryPath =
  /`((?:apps|configs|docs|games|packages|skills|tests|tooling)\/[^`\s]+)`/gu;
const rootScript = /`pnpm ([a-z][a-z0-9:-]*)[ `]/gu;
const referenceLink = /references\/[\w.-]+\.md/gu;

const sdkSchema = z.object({ name: z.string() });
const rootSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
});

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await filesUnder(path)));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

function frontMatter(text: string): Readonly<Record<string, string>> {
  const match = /^---\n([\s\S]*?)\n---\n/u.exec(text);
  const fields: Record<string, string> = {};
  for (const line of (match?.[1] ?? "").split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return fields;
}

export async function findSkillViolations(
  root: string,
): Promise<readonly string[]> {
  const skillsRoot = resolve(root, "skills");
  if (!(await exists(skillsRoot))) return [];
  const sdk = sdkSchema.parse(
    JSON.parse(
      await readFile(resolve(root, "packages/game-sdk/package.json"), "utf8"),
    ),
  );
  const scripts =
    rootSchema.parse(
      JSON.parse(await readFile(resolve(root, "package.json"), "utf8")),
    ).scripts ?? {};
  const brand = sdk.name.startsWith("@")
    ? (sdk.name.slice(1).split("/")[0] ?? "")
    : "";
  const violations: string[] = [];
  const folders = (await readdir(skillsRoot, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory(),
  );
  for (const folder of folders) {
    const directory = resolve(skillsRoot, folder.name);
    const label = `skills/${folder.name}`;
    const main = await readFile(resolve(directory, "SKILL.md"), "utf8").catch(
      () => null,
    );
    if (main === null) {
      violations.push(`${label} has no SKILL.md.`);
      continue;
    }
    const fields = frontMatter(main);
    if (fields.name !== folder.name)
      violations.push(
        `${label}/SKILL.md names itself "${fields.name ?? ""}", not "${folder.name}".`,
      );
    const description = fields.description ?? "";
    if (description === "" || description.length > maximumDescription)
      violations.push(
        `${label}/SKILL.md needs a description of 1 to ${String(maximumDescription)} characters.`,
      );
    if (main.split("\n").length > maximumSkillLines)
      violations.push(
        `${label}/SKILL.md is over ${String(maximumSkillLines)} lines; move detail into references/.`,
      );
    const linked = new Set(main.match(referenceLink) ?? []);
    for (const path of linked)
      if (!(await exists(resolve(directory, path))))
        violations.push(
          `${label}/SKILL.md links ${path}, which does not exist.`,
        );
    const references = (await exists(resolve(directory, "references")))
      ? await filesUnder(resolve(directory, "references"))
      : [];
    for (const file of references) {
      const path = relative(directory, file);
      if (!linked.has(path))
        violations.push(`${label}/${path} is not linked from SKILL.md.`);
    }
    for (const file of [resolve(directory, "SKILL.md"), ...references]) {
      const name = `${label}/${relative(directory, file)}`;
      const text = await readFile(file, "utf8");
      if (brand !== "" && text.toLowerCase().includes(brand.toLowerCase()))
        violations.push(
          `${name} names the platform ("${brand}"); say <sdk> and look the name up.`,
        );
      for (const [, path] of text.matchAll(repositoryPath))
        if (
          path !== undefined &&
          !path.includes("<") &&
          !(await exists(resolve(root, path)))
        )
          violations.push(`${name} names ${path}, which does not exist.`);
      for (const [, script] of text.matchAll(rootScript))
        if (
          script !== undefined &&
          !pnpmBuiltins.has(script) &&
          scripts[script] === undefined
        )
          violations.push(
            `${name} runs "pnpm ${script}", which is not a root script.`,
          );
    }
  }
  return violations;
}

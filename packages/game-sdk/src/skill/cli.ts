import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { argumentProblem } from "../arguments.ts";
import {
  installSkill,
  skillName,
  skillState,
  type InstallResult,
  type SkillSource,
  type SkillState,
} from "./install.ts";

export interface SkillCommand {
  // How the person types the command, for its usage line.
  readonly command: string;
  // The project the command works on when `--dir` is not given.
  readonly cwd: string;
  readonly source: SkillSource;
}

const commands = ["doctor", "install", "update"] as const;

const installedSaid = (result: InstallResult): string => {
  switch (result.kind) {
    case "installed":
    case "updated":
      return `Skill ${skillName} ${result.kind} (${result.files} files).`;
    case "unchanged":
      return `Skill ${skillName} is already current.`;
    case "kept":
      return `Not replaced: these installed files were edited here: ${result.files.join(", ")}. Run again with --force to replace them.`;
  }
};

const stateSaid = (state: SkillState, source: SkillSource): string => {
  switch (state.kind) {
    case "missing":
      return `Skill ${skillName} is not installed. Run the install command.`;
    case "current":
      return state.agents
        ? `Skill ${skillName} matches ${source.sdk} ${source.version}.`
        : `Skill ${skillName} matches ${source.sdk} ${source.version}, but AGENTS.md does not point at it. Run install again.`;
    case "modified":
      return `Skill ${skillName} has local edits in: ${state.files.join(", ")}. Run update --force to replace them.`;
    case "outdated":
      return `Skill ${skillName} is ${state.installed} but ${source.sdk} ships ${state.shipped}. Run update.`;
  }
};

// `<command> install|update|doctor [--dir <project>] [--from <folder>] [--no-agents] [--force]`: puts the build-a-game skill into a project (where an AI
// coding agent reads it), refreshes it when the SDK ships a newer one, and checks that the copy there is the one this SDK ships.
export async function runSkill(
  argv: readonly string[],
  context: SkillCommand,
): Promise<{ readonly code: number }> {
  const usage = `Usage: ${context.command} <${commands.join("|")}> [--dir <project>] [--from <skill-folder>] [--no-agents] [--force]`;
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      args: [...argv],
      options: {
        dir: { type: "string" },
        force: { type: "boolean" },
        from: { type: "string" },
        "no-agents": { type: "boolean" },
      },
    });
  } catch (error) {
    console.error(argumentProblem(error, usage));
    return { code: 2 };
  }
  const [name] = parsed.positionals;
  const chosen = commands.find((command) => command === name);
  if (chosen === undefined || parsed.positionals.length > 1) {
    console.error(usage);
    return { code: 2 };
  }
  const project = resolve(context.cwd, parsed.values.dir ?? ".");
  // The skill this SDK ships, unless the person points at another folder (the repository's own, while it is being written).
  const source =
    parsed.values.from === undefined
      ? context.source
      : {
          ...context.source,
          directory: resolve(context.cwd, parsed.values.from),
        };
  if (chosen === "doctor") {
    const state = await skillState(project, source);
    console.log(stateSaid(state, source));
    return { code: state.kind === "current" && state.agents ? 0 : 1 };
  }
  const result = await installSkill({
    agents: parsed.values["no-agents"] !== true,
    force: parsed.values.force === true,
    project,
    source,
  });
  console.log(installedSaid(result));
  return { code: result.kind === "kept" ? 1 : 0 };
}

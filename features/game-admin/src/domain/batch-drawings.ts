import { sanitizeDrawing, type DrawingPolicy } from "@frostbite/milestone-art";

import type { AdminGameInfo } from "../game-info.ts";

// A drawing chosen from a folder: the file's name and what it says.
export interface DrawingFile {
  readonly name: string;
  readonly text: string;
}

// Where one milestone stands in a batch of drawings, before anything is started:
// - `defined`: the contract has it already, so the batch leaves it alone;
// - `ready`: a drawing was chosen for it and passed the platform's own checks;
// - `refused`: a drawing was chosen and failed one, with the first problem it met;
// - `missing`: no drawing was chosen for it, so the batch does not touch it (it can still be defined without one, on its own).
export type BatchRow = {
  readonly milestoneId: string;
  readonly title: string;
} & (
  | { readonly state: "defined" | "missing" }
  | { readonly drawing: string; readonly state: "ready" }
  | { readonly detail: string; readonly state: "refused" }
);

export interface BatchPlan {
  // One row for each of the game's milestones, in the manifest's order.
  readonly rows: readonly BatchRow[];
  // Files that match no milestone of the game, by name.
  readonly unmatched: readonly string[];
}

// A file is named for the milestone it draws: `first-win.svg` is the drawing of `first-win`.
export const milestoneIdOfFile = (name: string): string =>
  name.replace(/\.svg$/iu, "");

// Matches the chosen files to the game's milestones and checks every drawing against the same rules the platform will hold it to when
// each step starts, so every refusal is known before anything is built or signed.
export function planBatch(input: {
  readonly defined: ReadonlySet<string>;
  readonly files: readonly DrawingFile[];
  readonly milestones: AdminGameInfo["milestones"];
  readonly policy: DrawingPolicy;
}): BatchPlan {
  const { defined, files, milestones, policy } = input;
  const known = new Set(milestones.map(({ id }) => id));
  const byMilestone = new Map<string, DrawingFile[]>();
  const unmatched: string[] = [];
  for (const file of files) {
    const id = milestoneIdOfFile(file.name);
    if (!known.has(id)) unmatched.push(file.name);
    else byMilestone.set(id, [...(byMilestone.get(id) ?? []), file]);
  }
  const rows = milestones.map(({ id, title }): BatchRow => {
    const chosen = byMilestone.get(id) ?? [];
    const [first] = chosen;
    if (defined.has(id)) return { milestoneId: id, state: "defined", title };
    if (first === undefined)
      return { milestoneId: id, state: "missing", title };
    // Two files for one milestone is a mistake to fix, not a choice for the platform to make.
    if (chosen.length > 1)
      return {
        detail: `${chosen.length} files are named for it.`,
        milestoneId: id,
        state: "refused",
        title,
      };
    const result = sanitizeDrawing(first.text, policy);
    return result.ok
      ? { drawing: first.text, milestoneId: id, state: "ready", title }
      : {
          detail: result.detail,
          milestoneId: id,
          state: "refused",
          title,
        };
  });
  return { rows, unmatched };
}

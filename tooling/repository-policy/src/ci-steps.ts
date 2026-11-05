// Reads the jobs and their `run:` steps out of .github/workflows/ci.yml, so `pnpm ci:local` runs what CI runs and cannot drift from it.
// Only the shapes the workflow uses are understood: job ids at two spaces, `needs`, a `matrix` with one `shard: [..]` list, steps that are
// `- name:` with a one-line `run:` or a `run: |` block. Anything else is left out, and the unit test reads the real workflow.
export interface CiStep {
  readonly name: string;
  readonly run: string;
}

export interface CiJob {
  readonly id: string;
  // The job only runs on some events (`if:` at the job level): pushes, pull requests.
  readonly conditional: boolean;
  readonly shards: readonly string[];
  readonly steps: readonly CiStep[];
}

const indentOf = (line: string) => (/^ */.exec(line)?.[0] ?? "").length;

export function parseCiJobs(workflow: string): readonly CiJob[] {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line === "jobs:");
  if (start < 0) return [];
  const jobs: {
    id: string;
    conditional: boolean;
    shards: string[];
    steps: { name: string; run: string }[];
  }[] = [];
  let step: { name: string; run: string } | undefined;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const header = /^ {2}([a-z][a-z0-9-]*):\s*$/.exec(line)?.[1];
    if (header !== undefined) {
      jobs.push({ conditional: false, id: header, shards: [], steps: [] });
      step = undefined;
      continue;
    }
    const job = jobs.at(-1);
    if (job === undefined) continue;
    if (/^ {4}if:/.test(line)) job.conditional = true;
    const shards = /^\s+shard:\s*\[([^\]]*)\]/.exec(line)?.[1];
    if (shards !== undefined)
      job.shards = shards.split(",").map((value) => value.trim());
    const name = /^ {6}- name:\s*(.+?)\s*$/.exec(line)?.[1];
    if (name !== undefined) {
      step = { name, run: "" };
      job.steps.push(step);
      continue;
    }
    if (step === undefined) continue;
    const single = /^ {8}run:\s*(?!\|)(\S.*?)\s*$/.exec(line)?.[1];
    if (single !== undefined) step.run = single;
    if (/^ {8}run:\s*\|\s*$/.test(line)) {
      const block: string[] = [];
      for (const next of lines.slice(index + 1)) {
        if (next.trim() !== "" && indentOf(next) <= 8) break;
        block.push(next.trim());
      }
      step.run = block.join("\n").trim();
    }
  }
  return jobs;
}

// What a step becomes on this machine, or null when it is left to the person running it (installing system packages needs root).
export function localCommand(
  run: string,
  shard: string | undefined,
): string | null {
  if (run === "" || /^sudo\b/.test(run)) return null;
  return run
    .replaceAll("${{ matrix.shard }}", shard ?? "")
    .replaceAll(" --with-deps", "");
}

// The jobs `pnpm ci:local` runs by default: the ones that need no Rust toolchain, no Docker image build and no push event.
export const defaultJobs = [
  "static",
  "typecheck",
  "tests",
  "game-simulations",
  "coverage-merge",
  "e2e",
] as const;

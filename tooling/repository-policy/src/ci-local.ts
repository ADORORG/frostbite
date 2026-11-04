import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { defaultJobs, localCommand, parseCiJobs } from "./ci-steps.ts";
import { ciWorkflowPath } from "./workflow-policy.ts";
import { repositoryRoot } from "./workspaces.ts";

// `pnpm ci:local [--job <id>]...`: runs the steps of the CI jobs from .github/workflows/ci.yml on this machine, the way the runner does:
// CI=true (CI worker counts, retries and timeouts), browsers installed into a folder of their own by the workflow's own install step (so a
// browser your machine happens to have cannot hide a missing install), and sharded jobs once per shard. Each step's output goes to
// .ci-local/logs. Contract (Rust), Docker and publish jobs are left to CI unless named with --job.
const root = repositoryRoot(import.meta.url);
const workflow = await readFile(resolve(root, ciWorkflowPath), "utf8");
const jobs = parseCiJobs(workflow);

const named = process.argv.flatMap((value, index, all) =>
  all[index - 1] === "--job" && value !== undefined ? [value] : [],
);
const wanted = named.length > 0 ? named : [...defaultJobs];
const unknown = wanted.filter((id) => !jobs.some((job) => job.id === id));
if (unknown.length > 0)
  throw new Error(`No such job in ${ciWorkflowPath}: ${unknown.join(", ")}`);

const logs = resolve(root, ".ci-local/logs");
await mkdir(logs, { recursive: true });
const environment = {
  ...process.env,
  CI: "true",
  PLAYWRIGHT_BROWSERS_PATH: resolve(root, ".ci-local/browsers"),
};

function run(command: string, log: string): Promise<number> {
  return new Promise((done) => {
    const out = createWriteStream(log);
    const child = spawn("bash", ["-ceo", "pipefail", command], {
      cwd: root,
      env: environment,
    });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    child.on("close", (code) => {
      out.end();
      done(code ?? 1);
    });
  });
}

const results: string[] = [];
let failed = false;
for (const id of wanted) {
  const job = jobs.find((candidate) => candidate.id === id);
  if (job === undefined) continue;
  for (const shard of job.shards.length > 0 ? job.shards : [undefined]) {
    const label = shard === undefined ? id : `${id} (${shard})`;
    for (const [number, step] of job.steps.entries()) {
      const command = localCommand(step.run, shard);
      if (command === null) continue;
      const log = resolve(
        logs,
        `${label.replaceAll(/[^a-z0-9]+/gi, "-")}-${String(number)}.log`,
      );
      const began = Date.now();
      process.stdout.write(`${label}: ${step.name} ... `);
      const code = await run(command, log);
      const seconds = Math.round((Date.now() - began) / 1000);
      console.log(`${code === 0 ? "ok" : "FAILED"} (${String(seconds)}s)`);
      results.push(`${code === 0 ? "PASS" : "FAIL"}  ${label}: ${step.name}`);
      if (code !== 0) {
        console.log(`  log: ${log}`);
        failed = true;
        break;
      }
    }
  }
}

console.log(`\n${results.join("\n")}`);
if (failed) process.exitCode = 1;

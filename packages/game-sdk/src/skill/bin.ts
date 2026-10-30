#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { runSkill } from "./cli.ts";

// The command's entry. The skill ships beside this file (`files/`, copied in by the package build); `--from` points it at another folder,
// as in the repository, where the skill's source is a folder of its own.
const own = z
  .object({ name: z.string(), version: z.string() })
  .parse(
    JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ),
  );
const directory = fileURLToPath(new URL("./files", import.meta.url));
const { code } = await runSkill(process.argv.slice(2), {
  command: basename(process.argv[1] ?? "skill"),
  cwd: process.cwd(),
  source: { directory, sdk: own.name, version: own.version },
});
if (code !== 0) process.exitCode = code;

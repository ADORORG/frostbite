#!/usr/bin/env node
import { run } from "./cli.ts";

// The command's entry: the same function the tests drive, started with the process's own arguments. The server it opens keeps
// the process running until it is stopped.
const { code } = await run(process.argv.slice(2));
if (code !== 0) process.exitCode = code;

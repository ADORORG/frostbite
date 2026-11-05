import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const bin = join(import.meta.dirname, "../src/dev-host/bin.ts");
let scratch = "";
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "dev-host-bin-"));
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));

// Runs the command as a process, and resolves with what it printed once `done` says it has printed enough, then stops it.
function command(args: string[], done: (output: string) => boolean) {
  return new Promise<{ code: number | null; error: string; output: string }>(
    (resolve) => {
      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", bin, ...args],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      let error = "";
      const finish = (code: number | null) => resolve({ code, error, output });
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        if (done(output)) {
          child.kill();
          finish(null);
        }
      });
      child.stderr.on(
        "data",
        (chunk: Buffer) => void (error += chunk.toString()),
      );
      child.on("exit", finish);
    },
  );
}

describe("the command as a process", () => {
  it("says how to use it and stops with a failure when it is given nothing", async () => {
    const result = await command([], () => false);
    expect(result.code).toBe(2);
    expect(result.error).toContain("Usage: frostbite-game-dev");
  });

  it("opens the test page for a game and prints where", async () => {
    await mkdir(join(scratch, "src"), { recursive: true });
    await writeFile(
      join(scratch, "index.html"),
      '<!doctype html><html><body><script src="main.js"></script></body></html>',
    );
    await writeFile(join(scratch, "src/main.ts"), "export {};");
    await writeFile(join(scratch, "game.json"), '{"id":"bin-game"}');
    const result = await command([scratch, "--port", "0"], (text) =>
      text.includes("http://"),
    );
    expect(result.output).toContain(
      "Local test host for bin-game: http://127.0.0.1:",
    );
  }, 30_000);
});

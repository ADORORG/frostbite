import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { run } from "../src/dev-host/cli.ts";
import type { DevHost } from "../src/dev-host/server.ts";

let scratch = "";
let host: DevHost | null = null;
let errors: string[] = [];
let said: string[] = [];

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "dev-host-cli-"));
  await mkdir(join(scratch, "src"), { recursive: true });
  await writeFile(
    join(scratch, "index.html"),
    '<!doctype html><html><body><script src="main.js"></script></body></html>',
  );
  await writeFile(join(scratch, "src/main.ts"), "export {};");
  errors = [];
  said = [];
  vi.spyOn(console, "error").mockImplementation(
    (text: string) => void errors.push(text),
  );
  vi.spyOn(console, "log").mockImplementation(
    (text: string) => void said.push(text),
  );
});
afterEach(async () => {
  await host?.close();
  host = null;
  await rm(scratch, { force: true, recursive: true });
  vi.restoreAllMocks();
});

const describeGame = (name = "game.json", body = '{"id":"cli-game"}') =>
  writeFile(join(scratch, name), body);

describe("the command that opens the test page", () => {
  it("says how to use it when it is given no folder, or two", async () => {
    expect((await run([])).code).toBe(2);
    expect((await run([scratch, "other"])).code).toBe(2);
    expect(errors.join("\n")).toContain("Usage: ador-game-dev <game-folder>");
  });

  it("says how to use it for an option it does not know, or one given with no value", async () => {
    expect((await run([scratch, "--bogus"])).code).toBe(2);
    expect((await run([scratch, "--port"])).code).toBe(2);
    expect(errors.join("\n")).toContain("Usage: ador-game-dev");
  });

  it.each(["abc", "-1", "70000", "1.5"])(
    "refuses %s as a port",
    async (port) => {
      await describeGame();
      expect((await run([scratch, `--port=${port}`])).code).toBe(2);
      expect(errors.join("\n")).toContain("is not a port");
    },
  );

  it("says when the game's description is missing, is not JSON, or is not a game description", async () => {
    expect((await run([scratch, "--port", "0"])).code).toBe(1);
    expect(errors.join("\n")).toContain("is not a game description");
    await describeGame("game.json", "not json");
    expect((await run([scratch, "--port", "0"])).code).toBe(1);
    await describeGame("game.json", '{"id":"Not A Slug"}');
    expect((await run([scratch, "--port", "0"])).code).toBe(1);
    expect(errors).toHaveLength(3);
  });

  it("opens the page for the game in the folder, and says where", async () => {
    await describeGame();
    const result = await run([scratch, "--port", "0"]);
    host = result.host;
    expect(result.code).toBe(0);
    expect(said.join("\n")).toContain("Local test host for cli-game:");
    expect(said.join("\n")).toContain(host?.url ?? "no host");
    expect((await fetch(`${host?.url ?? ""}/dev-config.json`)).status).toBe(
      200,
    );
  });

  it("takes the game's description from the file it is told to", async () => {
    await describeGame("elsewhere.json", '{"id":"named-elsewhere"}');
    const result = await run([
      scratch,
      "--game",
      join(scratch, "elsewhere.json"),
      "--port",
      "0",
    ]);
    host = result.host;
    expect(result.code).toBe(0);
    expect(
      await (await fetch(`${host?.url ?? ""}/dev-config.json`)).json(),
    ).toMatchObject({
      game: { id: "named-elsewhere" },
    });
  });
});

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Docker } from "@ador/test-kit/durable-container";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { confirmWipe } from "../src/confirm-wipe.ts";
import {
  assertOpenable,
  durableStack,
  stackSecrets,
  wipeStack,
} from "../src/durable-stack.ts";

let directory = "";
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "stack-"));
});
afterEach(async () => rm(directory, { force: true, recursive: true }));

const dockerWith = (present: readonly string[]) => {
  const calls: (readonly string[])[] = [];
  const docker: Docker = async (args) => {
    calls.push(args);
    if (args[0] !== "ps") return "";
    const name = (args[3] ?? "").slice("name=^".length, -1);
    return present.includes(name) ? "running" : "";
  };
  return { calls, docker };
};

describe("the passwords a kept stack was made with", () => {
  it("are made once, kept for the owner only, and read back the same on the next run", async () => {
    let made = 0;
    const make = () => `secret-${String(++made)}`;
    const first = await stackSecrets(directory, make);
    expect(first).toEqual({
      postgresPassword: "secret-1",
      s3Secret: "secret-2",
    });
    expect(await stackSecrets(directory, make)).toEqual(first);
    expect(made).toBe(2);
    expect((await stat(join(directory, "secrets.json"))).mode & 0o777).toBe(
      0o600,
    );
  });

  it("are made again if what was kept is unreadable or incomplete", async () => {
    await rm(directory, { recursive: true });
    const made = await stackSecrets(directory, () => "fresh");
    expect(made.postgresPassword).toBe("fresh");
    await rm(join(directory, "secrets.json"));
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(join(directory, "secrets.json"), '{"postgresPassword":"only"}'),
    );
    expect((await stackSecrets(directory, () => "again")).s3Secret).toBe(
      "again",
    );
  });
});

describe("opening data that was kept", () => {
  it("refuses, saying how to start over, when the database is there and its passwords are not", async () => {
    const { docker } = dockerWith([durableStack.postgres.container]);
    await expect(
      assertOpenable(directory, durableStack.postgres.container, docker),
    ).rejects.toThrow("pnpm stack --fresh");
  });

  it("goes on for a first run, and when the passwords are kept", async () => {
    const none = dockerWith([]);
    await expect(
      assertOpenable(directory, durableStack.postgres.container, none.docker),
    ).resolves.toBeUndefined();
    await stackSecrets(directory);
    const some = dockerWith([durableStack.postgres.container]);
    await expect(
      assertOpenable(directory, durableStack.postgres.container, some.docker),
    ).resolves.toBeUndefined();
  });
});

describe("starting over", () => {
  it("removes both containers, both volumes and the kept passwords, and only then", async () => {
    await stackSecrets(directory);
    const { calls, docker } = dockerWith([
      durableStack.postgres.container,
      durableStack.s3.container,
    ]);
    await wipeStack(directory, docker);
    expect(calls.filter(([verb]) => verb === "rm").map((c) => c[2])).toEqual([
      durableStack.postgres.container,
      durableStack.s3.container,
    ]);
    expect(
      calls.filter(([verb]) => verb === "volume").map((c) => c[3]),
    ).toEqual([durableStack.postgres.volume, durableStack.s3.volume]);
    await expect(readFile(join(directory, "secrets.json"))).rejects.toThrow();
  });

  it("asks first, and only the word delete goes on, unless the person already decided", async () => {
    const asked: string[] = [];
    const answer = (text: string) => async (question: string) => {
      asked.push(question);
      return text;
    };
    expect(await confirmWipe(false, answer("delete"))).toBe(true);
    expect(await confirmWipe(false, answer(" delete \n"))).toBe(true);
    expect(await confirmWipe(false, answer("yes"))).toBe(false);
    expect(await confirmWipe(false, answer(""))).toBe(false);
    expect(asked[0]).toContain("cannot be undone");
    expect(await confirmWipe(true, answer("no"))).toBe(true);
    expect(asked).toHaveLength(4);
  });
});

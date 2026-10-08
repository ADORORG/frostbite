import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startServiceProcess } from "../src/service-process.ts";

let directory = "";
const script = (name: string, body: string) =>
  writeFile(join(directory, name), body);

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "service-process-"));
  await script(
    "ready.ts",
    'console.error("booting"); console.error("service ready"); process.on("SIGTERM", () => process.exit(0)); setInterval(() => undefined, 1000);',
  );
  await script("crash.ts", 'console.error("oops"); process.exit(3);');
  await script(
    "stubborn.ts",
    'console.error("service ready"); process.on("SIGTERM", () => undefined); setInterval(() => undefined, 1000);',
  );
  await script("silent.ts", "setInterval(() => undefined, 1000);");
});
afterAll(() => rm(directory, { force: true, recursive: true }));

const base = () => ({ cwd: directory, env: { ...process.env } });

describe("service process", () => {
  it("waits for the readiness line, exposes stderr lines, and stops on SIGTERM", async () => {
    const service = await startServiceProcess({
      ...base(),
      entry: "ready.ts",
      readyLine: "service ready",
    });
    expect(service.lines()).toEqual(["booting", "service ready"]);
    expect(await service.stop()).toBe(0);
    expect(await service.stop()).toBe(0);
  });

  it("kills a service that ignores SIGTERM once the stop deadline passes", async () => {
    const service = await startServiceProcess({
      ...base(),
      entry: "stubborn.ts",
      readyLine: "service ready",
      stopTimeoutMs: 500,
    });
    const code = await Promise.race([
      service.stop(),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("still running"), 5_000),
      ),
    ]);
    expect(code).toBeNull();
  });

  it("fails fast with the exit code when the process dies before it is ready", async () => {
    await expect(
      startServiceProcess({
        ...base(),
        entry: "crash.ts",
        readyLine: "never",
        readyTimeoutMs: 20_000,
      }),
    ).rejects.toThrow("exited with code 3");
  });

  it("times out and stops the process when it never reports ready", async () => {
    await expect(
      startServiceProcess({
        ...base(),
        entry: "silent.ts",
        readyLine: "never",
        readyTimeoutMs: 1_000,
      }),
    ).rejects.toThrow('to log "never"');
  });
});

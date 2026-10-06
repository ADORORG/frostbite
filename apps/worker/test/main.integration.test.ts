import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { freePort, waitFor } from "@ador/test-kit/inngest-runtime";
import { describe, expect, it } from "vitest";

// Starts the real entry point as a process. No Inngest settings are provided on purpose, so every
// relay pass fails; the worker must stay up, keep answering liveness, log without secrets, and stop
// cleanly on SIGTERM.
describe("the worker process", () => {
  it("starts, stays live while its relay fails, logs safely, and stops on SIGTERM", async () => {
    const port = await freePort();
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
    for (const key of [
      "INNGEST_APP_ID",
      "INNGEST_BASE_URL",
      "INNGEST_DEV",
      "INNGEST_EVENT_KEY",
      "INNGEST_SIGNING_KEY",
    ])
      delete env[key];
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--experimental-strip-types",
        "src/main.ts",
      ],
      {
        cwd: new URL("..", import.meta.url),
        env,
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    const lines: string[] = [];
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) =>
      lines.push(...chunk.split("\n").filter(Boolean)),
    );
    const exited = new Promise<number | null>((resolve) =>
      child.on("close", resolve),
    );
    try {
      await waitFor(
        () =>
          lines.some((line) => line.includes("worker listening"))
            ? true
            : undefined,
        30_000,
        "the worker to listen",
      );
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      expect([health.status, await health.json()]).toEqual([
        200,
        { status: "ok" },
      ]);
      await waitFor(
        () =>
          lines.some((line) => line.includes("relay pass failed"))
            ? true
            : undefined,
        30_000,
        "a failed relay pass",
      );
      expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
      child.kill("SIGTERM");
      expect(
        await Promise.race([exited, delay(30_000).then(() => "timeout")]),
      ).toBe(0);
      expect(lines.some((line) => line.includes("worker stopped"))).toBe(true);
      for (const line of lines) {
        const entry: unknown = JSON.parse(line);
        expect(entry).toMatchObject({
          level: expect.stringMatching(/^(error|info)$/u),
          message: expect.any(String),
        });
        expect(line).not.toContain(process.env.DATABASE_URL ?? "never-set");
        expect(line).not.toMatch(/password|secret|signkey/iu);
      }
    } finally {
      child.kill("SIGKILL");
    }
  }, 120_000);
});

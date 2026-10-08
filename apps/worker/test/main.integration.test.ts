import { freePort, waitFor } from "@ador/test-kit/inngest-runtime";
import { startServiceProcess } from "@ador/test-kit/service-process";
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
    const worker = await startServiceProcess({
      cwd: new URL("..", import.meta.url),
      entry: "src/main.ts",
      env,
      readyLine: "worker listening",
    });
    try {
      await waitFor(
        () =>
          worker.lines().some((line) => line.includes("relay pass failed"))
            ? true
            : undefined,
        30_000,
        "a failed relay pass",
      );
      expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
      expect(await worker.stop()).toBe(0);
      const lines = worker.lines();
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
      await worker.stop();
    }
  }, 120_000);
});

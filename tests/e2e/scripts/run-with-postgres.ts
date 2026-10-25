import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { withDisposablePostgres } from "../../../packages/database/test/support/postgres-container.ts";

import { captureMailEnvironment } from "../src/manual-stack.ts";
import { normalizePlaywrightArguments } from "../src/playwright-arguments.ts";
import { resolveE2EServerConfig } from "../src/server-config.ts";
import { withUploadServices } from "../src/services.ts";
import { applicationEnvironment, seed } from "./stack-setup.ts";

async function runPlaywright(
  baseEnvironment: NodeJS.ProcessEnv,
  serviceEnvironment: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        ...normalizePlaywrightArguments(process.argv.slice(2)),
      ],
      {
        env: { ...process.env, ...baseEnvironment, ...serviceEnvironment },
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Playwright exited with code ${String(code)}`));
    });
  });
}

await withDisposablePostgres(async (databaseUrl) => {
  await seed(databaseUrl);
  const { baseURL } = resolveE2EServerConfig(process.env.E2E_BASE_URL);
  // The emails the app "sends" land in a directory the specs read, so a test can enter the code it was sent.
  const mailDirectory = await mkdtemp(join(tmpdir(), "ador-e2e-mail-"));
  const baseEnvironment = {
    ...applicationEnvironment(databaseUrl, baseURL),
    ...captureMailEnvironment(mailDirectory),
  };
  try {
    await withUploadServices(
      { baseEnvironment, webOrigin: new URL(baseURL).origin },
      (serviceEnvironment) =>
        runPlaywright(baseEnvironment, serviceEnvironment),
    );
  } finally {
    await rm(mailDirectory, { force: true, recursive: true });
  }
});

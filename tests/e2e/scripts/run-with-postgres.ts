import { spawn } from "node:child_process";

import { withDisposablePostgres } from "../../../packages/database/test/support/postgres-container.ts";

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
  const baseEnvironment = applicationEnvironment(databaseUrl, baseURL);
  await withUploadServices(
    { baseEnvironment, webOrigin: new URL(baseURL).origin },
    (serviceEnvironment) => runPlaywright(baseEnvironment, serviceEnvironment),
  );
});

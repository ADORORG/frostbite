import { spawn } from "node:child_process";

import { parseDatabaseEnvironment } from "../../src/connection/config.ts";
import { runMigrations } from "../../src/migrations/run.ts";
import { withDisposablePostgres } from "./postgres-container.ts";

type TestMode = "integration" | "coverage";

// What every test process of the run is given to reach the disposable database.
const databaseEnvironment = (url: string) => ({
  DATABASE_ACQUIRE_TIMEOUT_MS: "5000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_MIGRATION_URL: "",
  DATABASE_POOL_MAX: "4",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "5000",
  DATABASE_URL: url,
});

async function runVitest(mode: TestMode, url: string): Promise<void> {
  const args = ["exec", "vitest", "run", "--config", "vitest.config.ts"];
  if (mode === "integration") args.push("--project", "integration");
  else args.push("--coverage");
  // Migrated once, here, before any test file starts: test files run in parallel and each one's own migration of a fresh
  // database would race the others'. A file's own migration is then a no-op.
  await runMigrations(parseDatabaseEnvironment(databaseEnvironment(url)));

  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", args, {
      env: { ...process.env, ...databaseEnvironment(url) },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Vitest exited with code ${String(code)}`));
    });
  });
}

const mode = process.argv[2];
if (mode !== "integration" && mode !== "coverage") {
  throw new Error("Expected integration or coverage test mode");
}
await withDisposablePostgres((url) => runVitest(mode, url));

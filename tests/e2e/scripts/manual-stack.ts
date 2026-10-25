import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";

import { createDatabaseClient, createDatabasePool } from "@ador/database";

import { startDurableS3Runtime } from "@ador/test-kit/s3-durable";

import {
  formatStackGuide,
  resolveStackServer,
  stackActors,
  captureMailEnvironment,
} from "../src/manual-stack.ts";
import {
  chainSettingsFrom,
  describeChain,
} from "../src/stack-chain-environment.ts";
import {
  durableStack,
  stackSecrets,
  wipeStack,
  withDurablePostgres,
} from "../src/durable-stack.ts";
import { confirmWipe } from "../src/confirm-wipe.ts";
import { createStackProxy } from "../src/stack-proxy.ts";
import { withUploadServices } from "../src/services.ts";
import {
  applicationEnvironment,
  reviveSession,
  seedOnce,
} from "./stack-setup.ts";

// Runs the whole product locally for a person to drive by hand: PostgreSQL, local S3, the worker, a
// self-hosted Inngest, and the web server, with the same users the browser tests use. The database and the
// storage are kept between runs (Docker volumes), so what was done in them, such as a template published on
// a real test network, is still there next time. `pnpm stack --fresh` deletes them first, after asking.
// Stops everything when interrupted. Start it with `pnpm stack` from the repository root.

const repositoryRoot = resolve(import.meta.dirname, "../../..");
// The app's own settings file, where a developer keeps the rewards chain; only its chain settings are used (see the module).
const settingsFile = resolve(repositoryRoot, "apps/web/.env.local");
const readyTimeoutMilliseconds = 90_000;
// Where the passwords the kept database and storage were made with are held (ignored by git).
const dataDirectory = resolve(repositoryRoot, ".stack-data");

function run(
  command: string[],
  environment: NodeJS.ProcessEnv,
  cwd = repositoryRoot,
): ChildProcess {
  const [program, ...args] = command;
  if (program === undefined) throw new Error("No command to run");
  return spawn(program, args, {
    cwd,
    env: environment,
    stdio: "inherit",
  });
}

function finished(child: ChildProcess): Promise<number | null> {
  return new Promise((resolveExit, reject) => {
    child.on("error", reject);
    child.on("exit", resolveExit);
  });
}

// Always built, so what runs is the code in this checkout and the network it is set to (the network can be fixed into pages at build
// time). Next reuses its cache, so an unchanged tree builds quickly. `--no-build` skips it for someone who knows nothing changed.
async function build(environment: NodeJS.ProcessEnv): Promise<void> {
  if (process.argv.includes("--no-build")) return;
  console.log("Building the web app (reuses the cache when nothing changed).");
  const code = await finished(
    run(["pnpm", "--filter", "web", "build"], environment),
  );
  if (code !== 0)
    throw new Error(`The web build failed (exit ${String(code)}).`);
}

async function waitUntilServing(
  url: string,
  server: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + readyTimeoutMilliseconds;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error("The web server stopped before it was ready.");
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`The web server did not answer at ${url} in time.`);
}

// A port nobody is using, for the web server behind the sign-in front door.
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address !== null
          ? resolvePort(address.port)
          : reject(new Error("No free port")),
      );
    });
  });
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
}

// Waits for the first interrupt. Later interrupts are ignored on purpose: a terminal sends Ctrl+C to the
// whole process group and pnpm forwards it again, so a second one arrives while the containers are being
// removed, and letting it kill this process would leave them running.
function untilInterrupted(): Promise<void> {
  return new Promise((resolveStop) => {
    let stopping = false;
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.on(signal, () => {
        if (stopping) return;
        stopping = true;
        console.log(`\nStopping (${signal})...`);
        resolveStop();
      });
  });
}

const chainSettings = chainSettingsFrom(
  await readFile(settingsFile, "utf8").catch(() => null),
  process.env,
);
const stackEnvironment = { ...process.env, ...chainSettings };
if (process.argv.includes("--fresh")) {
  if (!(await confirmWipe(process.argv.includes("--yes")))) {
    console.log("Nothing was deleted.");
    process.exit(0);
  }
  await wipeStack(dataDirectory);
  console.log("The stack's database and storage were deleted.");
}
await build(stackEnvironment);
const { baseURL, port } = resolveStackServer();
const secrets = await stackSecrets(dataDirectory);
await withDurablePostgres({ directory: dataDirectory }, async (databaseUrl) => {
  console.log(
    (await seedOnce(databaseUrl)) === "kept"
      ? "Keeping the data this stack already has (`pnpm stack --fresh` starts over)."
      : "Made a new database and seeded it.",
  );
  const baseEnvironment = applicationEnvironment(databaseUrl, baseURL);
  // For the front door's sign-in, which makes a signed-out person's session usable again.
  const sessionPool = createDatabasePool({
    DATABASE_ACQUIRE_TIMEOUT_MS: 5_000,
    DATABASE_IDLE_TIMEOUT_MS: 1_000,
    DATABASE_POOL_MAX: 2,
    DATABASE_SSL_MODE: "disable",
    DATABASE_STATEMENT_TIMEOUT_MS: 5_000,
    DATABASE_URL: databaseUrl,
  });
  try {
    await withUploadServices(
      {
        baseEnvironment,
        startStorage: (settings) =>
          startDurableS3Runtime({
            ...settings,
            container: durableStack.s3.container,
            secret: secrets.s3Secret,
            volume: durableStack.s3.volume,
          }),
        webOrigin: new URL(baseURL).origin,
      },
      async (serviceEnvironment) => {
        // The server is started directly (not through pnpm) so the process stopped below is the server
        // itself: a wrapper that is stopped would leave the real server running and the port taken.
        const upstreamPort = await freePort();
        const server = run(
          ["node", "--experimental-strip-types", "scripts/start-standalone.ts"],
          {
            ...stackEnvironment,
            ...captureMailEnvironment(dataDirectory),
            ...baseEnvironment,
            ...serviceEnvironment,
            HOSTNAME: "127.0.0.1",
            PORT: String(upstreamPort),
          },
          resolve(repositoryRoot, "apps/web"),
        );
        try {
          await waitUntilServing(`http://127.0.0.1:${upstreamPort}`, server);
          // The people use the stack's address; the front door serves the test sign-in and passes the rest on.
          const sessions = createDatabaseClient(sessionPool);
          const frontDoor = createStackProxy({
            actors: stackActors,
            origin: baseURL,
            startSession: ({ token }) => reviveSession(sessions, token),
            upstreamPort,
          });
          await listen(frontDoor, Number(port));
          console.log(formatStackGuide({ baseURL }));
          console.log(`${describeChain(stackEnvironment)}\n`);
          try {
            await untilInterrupted();
          } finally {
            frontDoor.closeAllConnections();
            frontDoor.close();
          }
        } finally {
          server.kill("SIGTERM");
          await finished(server).catch(() => null);
        }
      },
    );
  } finally {
    await sessionPool.end();
  }
});

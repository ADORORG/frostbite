import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";

import { withDisposablePostgres } from "../../../packages/database/test/support/postgres-container.ts";

import {
  formatStackGuide,
  resolveStackServer,
  stackActors,
} from "../src/manual-stack.ts";
import { createStackProxy } from "../src/stack-proxy.ts";
import { withUploadServices } from "../src/services.ts";
import { applicationEnvironment, seed } from "./stack-setup.ts";

// Runs the whole product locally for a person to drive by hand: a disposable PostgreSQL, local S3,
// the worker, a self-hosted Inngest, and the web server, with the same users the browser tests use.
// Stops everything when interrupted. Start it with `pnpm stack` from the repository root.

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const builtServer = resolve(
  repositoryRoot,
  "apps/web/.next/standalone/apps/web/server.js",
);
const readyTimeoutMilliseconds = 90_000;

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

async function ensureBuild(): Promise<void> {
  try {
    await access(builtServer);
    return;
  } catch {
    console.log("No web build found; building it first (this takes a minute).");
  }
  const code = await finished(
    run(["pnpm", "--filter", "web", "build"], process.env),
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

function untilInterrupted(): Promise<void> {
  return new Promise((resolveStop) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.once(signal, () => {
        console.log(`\nStopping (${signal})...`);
        resolveStop();
      });
  });
}

await ensureBuild();
const { baseURL, port } = resolveStackServer();
await withDisposablePostgres(async (databaseUrl) => {
  await seed(databaseUrl);
  const baseEnvironment = applicationEnvironment(databaseUrl, baseURL);
  await withUploadServices(
    { baseEnvironment, webOrigin: new URL(baseURL).origin },
    async (serviceEnvironment) => {
      // The server is started directly (not through pnpm) so the process stopped below is the server
      // itself: a wrapper that is stopped would leave the real server running and the port taken.
      const upstreamPort = await freePort();
      const server = run(
        ["node", "--experimental-strip-types", "scripts/start-standalone.ts"],
        {
          ...process.env,
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
        const frontDoor = createStackProxy({
          actors: stackActors,
          origin: baseURL,
          upstreamPort,
        });
        await listen(frontDoor, Number(port));
        console.log(formatStackGuide({ baseURL }));
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
});

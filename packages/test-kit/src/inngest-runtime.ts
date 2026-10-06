import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const defaultImage = "inngest/inngest:latest";
const defaultReadyTimeoutMs = 30_000;

function run(args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    /* v8 ignore next -- only when the docker binary itself is missing. */
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(`docker exited with code ${String(code)}`)),
    );
  });
}

// Picks a free loopback port so an app client can be configured with the runtime's address before
// the runtime starts (the runtime syncs the app endpoint at startup).
export async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const address = probe.address();
  /* v8 ignore next 2 -- a listening TCP server always reports an address object. */
  if (address === null || typeof address === "string")
    throw new Error("Could not reserve a TCP port.");
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return address.port;
}

// `docker logs` replays the container's stdout and stderr; Inngest logs to stderr.
function logsOf(containerName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["logs", containerName], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => {
        output += chunk;
      });
    }
    /* v8 ignore next -- only when the docker binary itself is missing. */
    child.on("error", reject);
    child.on("close", () => resolve(output));
  });
}

export interface InngestRuntime {
  readonly baseUrl: string;
  readonly eventKey: string;
  logs(): Promise<string>;
  readonly signingKey: string;
  stop(): Promise<void>;
}

/* v8 ignore next 2 -- ends the test process by design; tests inject their own terminate. */
const endProcess = (signal: NodeJS.Signals) =>
  process.kill(process.pid, signal);

// Starts the real, self-hosted Inngest server with event and signing keys enforced, so signed
// requests are exercised exactly as in production. The app endpoint must already be listening
// because the server syncs it once at startup.
export async function startInngestRuntime(input: {
  readonly appPort: number;
  readonly eventKey: string;
  // Host port the runtime listens on, chosen by the caller via freePort().
  readonly hostPort: number;
  readonly retryIntervalSeconds: number;
  // Hex string with an even number of characters, as the server requires.
  readonly signingKey: string;
  // Injectable so cleanup on SIGINT/SIGTERM is testable without ending the test process.
  readonly terminate?: (signal: NodeJS.Signals) => void;
  readonly image?: string;
  readonly readyTimeoutMs?: number;
}): Promise<InngestRuntime> {
  const containerName = `ador-inngest-${randomUUID()}`;
  const { eventKey, signingKey } = input;
  let started = false;
  const removeSync = () => {
    if (started)
      spawnSync("docker", ["rm", "--force", containerName], {
        stdio: "ignore",
      });
    started = false;
  };
  const interrupt = (signal: NodeJS.Signals) => {
    removeSync();
    (input.terminate ?? endProcess)(signal);
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const stop = async () => {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    if (started) await run(["rm", "--force", containerName]);
    started = false;
  };
  try {
    await run([
      "run",
      "--detach",
      "--name",
      containerName,
      "--add-host",
      "host.docker.internal:host-gateway",
      "--publish",
      `127.0.0.1:${input.hostPort}:8288`,
      input.image ?? defaultImage,
      "inngest",
      "start",
      "--event-key",
      eventKey,
      "--signing-key",
      signingKey,
      "--sdk-url",
      `http://host.docker.internal:${input.appPort}/api/inngest`,
      "--retry-interval",
      String(input.retryIntervalSeconds),
    ]);
    started = true;
    const baseUrl = `http://127.0.0.1:${input.hostPort}`;
    const deadline =
      Date.now() + (input.readyTimeoutMs ?? defaultReadyTimeoutMs);
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${baseUrl}/health`)).ok)
          return {
            baseUrl,
            eventKey,
            logs: () => logsOf(containerName),
            signingKey,
            stop,
          };
      } catch {
        // not listening yet
      }
      await delay(250);
    }
    throw new Error("Inngest runtime did not become ready");
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function waitFor<Value>(
  read: () => Promise<Value | undefined> | Value | undefined,
  timeoutMs: number,
  label: string,
): Promise<Value> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await delay(250);
  }
}

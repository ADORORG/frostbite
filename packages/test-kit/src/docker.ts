import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

export function runDocker(args: readonly string[]): Promise<string> {
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

// Picks a free loopback port so a client can be configured with a runtime's address before the
// runtime starts.
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

// `docker logs` replays the container's stdout and stderr.
export function containerLogs(containerName: string): Promise<string> {
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

/* v8 ignore next 2 -- ends the test process by design; tests inject their own terminate. */
const endProcess = (signal: NodeJS.Signals) =>
  process.kill(process.pid, signal);

export interface ContainerGuard {
  // Call once `docker run` has succeeded so cleanup knows there is something to remove.
  markStarted(): void;
  stop(): Promise<void>;
}

// Removes the named container on stop and, synchronously, on SIGINT/SIGTERM so an interrupted run
// never leaks it. `terminate` is injectable so signal handling is testable without ending the test
// process.
export function guardContainer(
  containerName: string,
  terminate: (signal: NodeJS.Signals) => void = endProcess,
): ContainerGuard {
  let started = false;
  const interrupt = (signal: NodeJS.Signals) => {
    if (started)
      spawnSync("docker", ["rm", "--force", containerName], {
        stdio: "ignore",
      });
    started = false;
    terminate(signal);
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  return {
    markStarted: () => {
      started = true;
    },
    stop: async () => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      if (started) await runDocker(["rm", "--force", containerName]);
      started = false;
    },
  };
}

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Port over "start the decoder in another process", so orchestration can be tested without one.
export interface WorkerProcess {
  kill(): void;
  onExit(listener: (exitCode: number | null) => void): void;
  onFailure(listener: (error: Error) => void): void;
  onOutput(listener: (chunk: Buffer) => void): void;
  send(request: Uint8Array): void;
}

export interface WorkerLaunchOptions {
  readonly heapMegabytes: number;
}

export type WorkerLauncher = (options: WorkerLaunchOptions) => WorkerProcess;

const bundledWorker = fileURLToPath(new URL("./worker.ts", import.meta.url));

// Nothing ambient (secrets, credentials, provider settings) reaches code that handles untrusted
// bytes. NODE_ENV is the single entry because Next.js types require the key on every environment.
const workerEnvironment = { NODE_ENV: "production" } as const;

// Starts the worker as a Node process with only `workerEnvironment`. stderr is discarded because
// decoder messages describe untrusted input.
export function createNodeWorkerLauncher(
  workerPath: string = bundledWorker,
): WorkerLauncher {
  return ({ heapMegabytes }) => {
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        `--max-old-space-size=${heapMegabytes}`,
        workerPath,
      ],
      { env: workerEnvironment, stdio: ["pipe", "pipe", "ignore"] },
    );
    // A worker that exits early closes stdin; that outcome is reported through onExit.
    child.stdin.on("error", () => undefined);
    return {
      kill: () => void child.kill("SIGKILL"),
      onExit: (listener) => void child.on("close", listener),
      onFailure: (listener) => void child.on("error", listener),
      onOutput: (listener) =>
        void child.stdout.on("data", (chunk: Buffer) => listener(chunk)),
      send: (request) => void child.stdin.end(request),
    };
  };
}

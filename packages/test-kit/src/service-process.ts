import { spawn } from "node:child_process";

import { waitFor } from "./inngest-runtime.ts";

export interface ServiceProcess {
  // Everything the service has written to stderr, one entry per line.
  lines(): readonly string[];
  // Sends SIGTERM and resolves with the exit code once the process has gone; a process that has not
  // exited by the stop deadline is killed, which reports a null code.
  stop(): Promise<number | null>;
}

// Starts one of the repository's Node entry points as a real child process (type stripping, no build
// step) and waits until it logs a readiness line. The service logs structured JSON lines to stderr.
export async function startServiceProcess(input: {
  readonly cwd: string | URL;
  readonly entry: string;
  readonly env: NodeJS.ProcessEnv;
  readonly readyLine: string;
  readonly readyTimeoutMs?: number;
  // How long a stop waits for a graceful exit before killing the process.
  readonly stopTimeoutMs?: number;
}): Promise<ServiceProcess> {
  const child = spawn(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      "--experimental-strip-types",
      input.entry,
    ],
    { cwd: input.cwd, env: input.env, stdio: ["ignore", "ignore", "pipe"] },
  );
  const lines: string[] = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) =>
    lines.push(...chunk.split("\n").filter(Boolean)),
  );
  const exited = new Promise<number | null>((resolve) =>
    child.on("close", resolve),
  );
  const stop = async () => {
    child.kill("SIGTERM");
    const deadline = setTimeout(
      () => child.kill("SIGKILL"),
      input.stopTimeoutMs ?? 30_000,
    );
    try {
      return await exited;
    } finally {
      clearTimeout(deadline);
    }
  };
  try {
    await Promise.race([
      waitFor(
        () =>
          lines.some((line) => line.includes(input.readyLine))
            ? true
            : undefined,
        input.readyTimeoutMs ?? 30_000,
        `${input.entry} to log "${input.readyLine}"`,
      ),
      exited.then((code) => {
        throw new Error(
          `${input.entry} exited with code ${String(code)} before it was ready.`,
        );
      }),
    ]);
  } catch (error) {
    await stop();
    throw error;
  }
  return { lines: () => lines, stop };
}

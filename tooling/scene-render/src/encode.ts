import { spawn } from "node:child_process";
import { once } from "node:events";

// Runs ffmpeg with `args`, feeds it each chunk from `chunks` on its input, and resolves when it has finished writing. A command that
// cannot start, or that ends with an error, rejects with what it said, so a half-written file is never taken for a finished one.
export async function runEncoder(
  args: readonly string[],
  chunks: Iterable<Uint8Array>,
  command = "ffmpeg",
): Promise<void> {
  const child = spawn(command, [...args], {
    stdio: ["pipe", "ignore", "pipe"],
  });
  let said = "";
  child.stderr.on("data", (text: Buffer) => {
    said += text.toString();
  });
  const finished = new Promise<void>((resolve, reject) => {
    child.once("error", (cause) => {
      reject(new Error(`${command} could not start: ${cause.message}`));
    });
    child.once("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`ffmpeg stopped with code ${String(code)}: ${said.trim()}`),
        );
    });
  });
  // A pipe that closes early (the encoder stopped) is reported by `finished`, with the reason; the write error is only its echo.
  child.stdin.on("error", () => undefined);
  try {
    for (const chunk of chunks) {
      if (!child.stdin.write(chunk)) await once(child.stdin, "drain");
    }
  } catch {
    // Reported by `finished`.
  } finally {
    child.stdin.end();
  }
  await finished;
}

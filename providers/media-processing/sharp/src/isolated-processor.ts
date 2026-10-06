import type {
  ImageProcessor,
  ProcessImageInput,
  ProcessImageResult,
} from "@ador/media/processing";
import type { DerivativePolicy } from "@ador/shared/uploads";

import { encodeFrame, maximumHeaderBytes } from "./protocol.ts";
import { isWorkerFault } from "./exit-codes.ts";
import type { WorkerLauncher } from "./process-launcher.ts";
import { interpretReply } from "./reply.ts";

const limitExceeded: ProcessImageResult = {
  ok: false,
  reason: "processing-limit-exceeded",
};

// Returns a function that cancels the timer.
export type Schedule = (action: () => void, delayMs: number) => () => void;

const realSchedule: Schedule = (action, delayMs) => {
  const timer = setTimeout(action, delayMs);
  return () => clearTimeout(timer);
};

export interface IsolatedProcessorDependencies {
  readonly launcher: WorkerLauncher;
  readonly policy: Pick<
    DerivativePolicy,
    "maxDerivativeBytes" | "wallTimeMs" | "workerMaxHeapMegabytes"
  >;
  readonly schedule?: Schedule;
}

// Runs each request in a fresh worker with a heap cap, a wall-time kill, and a bounded output
// buffer. A file that hits a limit is a terminal rejection; a malformed worker reply or a launch
// failure, or a worker that exits with its own failure code, is a platform fault and rejects,
// leaving the asset retryable.
export function createIsolatedImageProcessor(
  dependencies: IsolatedProcessorDependencies,
): ImageProcessor {
  const { launcher, policy } = dependencies;
  const schedule = dependencies.schedule ?? realSchedule;
  return {
    process(input: ProcessImageInput): Promise<ProcessImageResult> {
      const outputCap =
        policy.maxDerivativeBytes * input.derivatives.length +
        maximumHeaderBytes;
      const request = encodeFrame(
        {
          byteLength: input.bytes.length,
          derivatives: input.derivatives,
          expected: input.expected,
          limits: input.limits,
          quality: input.quality,
        },
        input.bytes,
      );
      return new Promise((resolve, reject) => {
        const worker = launcher({
          heapMegabytes: policy.workerMaxHeapMegabytes,
        });
        const chunks: Buffer[] = [];
        let received = 0;
        let killed = false;
        const kill = () => {
          killed = true;
          worker.kill();
        };
        const cancel = schedule(kill, policy.wallTimeMs);
        worker.onOutput((chunk) => {
          received += chunk.length;
          if (received > outputCap) kill();
          else chunks.push(chunk);
        });
        worker.onFailure((error) => {
          cancel();
          reject(error);
        });
        worker.onExit((exitCode) => {
          cancel();
          if (killed) return resolve(limitExceeded);
          // The worker's own failure exits (cannot start, protocol violation) are platform faults and
          // stay retryable; death by signal or an abort is what a resource-exhausting file looks like.
          if (isWorkerFault(exitCode))
            return reject(new Error(`Worker exited with code ${exitCode}.`));
          if (exitCode !== 0) return resolve(limitExceeded);
          try {
            resolve(
              interpretReply(
                Buffer.concat(chunks),
                input,
                policy.maxDerivativeBytes,
              ),
            );
          } catch (error) {
            reject(error);
          }
        });
        worker.send(request);
      });
    },
  };
}

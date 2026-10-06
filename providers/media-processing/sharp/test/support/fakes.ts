import type { Schedule } from "../../src/isolated-processor.ts";
import type {
  WorkerLaunchOptions,
  WorkerLauncher,
  WorkerProcess,
} from "../../src/process-launcher.ts";

// A worker the test drives by hand: it records what it was sent and emits only what it is told.
export class FakeWorker implements WorkerProcess {
  killed = false;
  sent: Uint8Array | undefined;
  private exit: (exitCode: number | null) => void = () => undefined;
  private failure: (error: Error) => void = () => undefined;
  private output: (chunk: Buffer) => void = () => undefined;

  kill(): void {
    this.killed = true;
  }
  onExit(listener: (exitCode: number | null) => void): void {
    this.exit = listener;
  }
  onFailure(listener: (error: Error) => void): void {
    this.failure = listener;
  }
  onOutput(listener: (chunk: Buffer) => void): void {
    this.output = listener;
  }
  send(request: Uint8Array): void {
    this.sent = request;
  }
  emitOutput(chunk: Buffer): void {
    this.output(chunk);
  }
  emitExit(exitCode: number | null): void {
    this.exit(exitCode);
  }
  emitFailure(error: Error): void {
    this.failure(error);
  }
}

export function fakeLauncher() {
  const worker = new FakeWorker();
  const launches: WorkerLaunchOptions[] = [];
  const launcher: WorkerLauncher = (options) => {
    launches.push(options);
    return worker;
  };
  return { launcher, launches, worker };
}

export function fakeSchedule() {
  const state = {
    action: undefined as (() => void) | undefined,
    cancelled: false,
    delayMs: undefined as number | undefined,
  };
  const schedule: Schedule = (action, delayMs) => {
    state.action = action;
    state.delayMs = delayMs;
    return () => {
      state.cancelled = true;
    };
  };
  return { schedule, state };
}

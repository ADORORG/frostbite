import {
  drainLoopPolicySchema,
  type DrainLoopPolicy,
} from "./workflow-policy.ts";

export interface DrainLoopDependencies {
  readonly failureMessage: string;
  onError(error: Error): void;
  // One bounded pass; resolves with how much work it found. Work means "go again now"; none means
  // wait the idle delay.
  pass(): Promise<number>;
  // Resolves after `delayMs`, or early when the signal aborts.
  sleep(delayMs: number, signal: AbortSignal): Promise<void>;
  readonly signal: AbortSignal;
}

// Runs passes until aborted: a pass that found work is followed at once by another, an empty pass
// waits, and a failed pass reports and backs off, so one failure never stops the loop. Generic over
// what a pass does (relaying outbox rows, removing abandoned uploads).
export async function runDrainLoop(
  dependencies: DrainLoopDependencies,
  policyInput: DrainLoopPolicy,
): Promise<void> {
  const policy = drainLoopPolicySchema.parse(policyInput);
  const { failureMessage, onError, pass, signal, sleep } = dependencies;
  while (!signal.aborted) {
    let delayMs: number;
    try {
      delayMs = (await pass()) > 0 ? 0 : policy.idleDelayMs;
    } catch (error) {
      onError(error instanceof Error ? error : new Error(failureMessage));
      delayMs = policy.errorDelayMs;
    }
    if (delayMs > 0 && !signal.aborted) await sleep(delayMs, signal);
  }
}

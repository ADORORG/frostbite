import { runDrainLoop } from "./drain-loop.ts";
import type { OutboxRelayResult } from "./outbox-relay.ts";
import type { RelayLoopPolicy } from "./workflow-policy.ts";

export interface RelayLoopDependencies {
  onError(error: Error): void;
  // Resolves after `delayMs`, or early when the signal aborts.
  sleep(delayMs: number, signal: AbortSignal): Promise<void>;
  relay(): Promise<OutboxRelayResult>;
  readonly signal: AbortSignal;
}

// Runs the relay until aborted. It is independent of any workflow provider, so work recorded during
// a provider outage is delivered once the provider returns (ADR-003). A batch that claimed work is
// followed immediately by another; an empty batch waits; a failed batch backs off.
export function runOutboxRelayLoop(
  dependencies: RelayLoopDependencies,
  policy: RelayLoopPolicy,
): Promise<void> {
  const { relay, ...rest } = dependencies;
  return runDrainLoop(
    {
      ...rest,
      failureMessage: "Relay failed.",
      pass: async () => (await relay()).claimed,
    },
    policy,
  );
}

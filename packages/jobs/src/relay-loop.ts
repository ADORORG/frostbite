import type { OutboxRelayResult } from "./outbox-relay.ts";
import {
  relayLoopPolicySchema,
  type RelayLoopPolicy,
} from "./workflow-policy.ts";

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
export async function runOutboxRelayLoop(
  dependencies: RelayLoopDependencies,
  policyInput: RelayLoopPolicy,
): Promise<void> {
  const policy = relayLoopPolicySchema.parse(policyInput);
  const { onError, relay, signal, sleep } = dependencies;
  while (!signal.aborted) {
    let delayMs: number;
    try {
      const result = await relay();
      delayMs = result.claimed > 0 ? 0 : policy.idleDelayMs;
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Relay failed."));
      delayMs = policy.errorDelayMs;
    }
    if (delayMs > 0 && !signal.aborted) await sleep(delayMs, signal);
  }
}

import type { MethodKind } from "../methods/contracts.ts";

// How many digits a code has, how long it lives and how often it may be asked for: one record per channel, because a text message costs
// money and an email does not (ADR-021 point 9).
export interface ContactCodePolicy {
  readonly codeLength: number;
  readonly lifetimeMs: number;
  // Tries at one code, right or wrong, after which it is dead.
  readonly maximumAttempts: number;
  // The most codes sent to one destination in `sendWindowMs`.
  readonly maximumSendsPerWindow: number;
  // The least time between two codes to one destination.
  readonly resendCooldownMs: number;
  readonly sendWindowMs: number;
}

// A way of reaching a person with a code: email today, a text message later. The one-time-code service is the same for all of them;
// a channel says only how its destinations are written, how a code is delivered, and what it allows.
export interface ContactChannel {
  // What a new account made by signing in through this channel is called until the person says otherwise.
  readonly accountName: string;
  // Sends the code. Rejects when it did not go, and the service then treats the code as never issued.
  deliver(destination: string, code: string): Promise<void>;
  // The method kind this channel's identities are held under (`email`).
  readonly kind: MethodKind;
  // The one written form of a destination, so "Ada@Example.com " and "ada@example.com" are one address; null when what was typed
  // cannot be a destination at all.
  normalize(raw: string): string | null;
  readonly policy: ContactCodePolicy;
}

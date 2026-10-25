// The email one-time code (ADR-021 point 9), as a record: a change is a new version. A code is six digits, so the guard against
// guessing is the number of tries (a million codes, five tries) and how short its life is, not its length; a person who needs more
// than one send waits a minute between them and gets a few an hour.
export const emailCodePolicy = {
  // Digits in a code.
  codeLength: 6,
  // How long a code works.
  lifetimeMs: 10 * 60 * 1000,
  // Tries at one code, right or wrong, after which it is dead.
  maximumAttempts: 5,
  // The most codes sent to one address in `sendWindowMs`.
  maximumSendsPerWindow: 5,
  // The least time between two codes to one address.
  resendCooldownMs: 60 * 1000,
  sendWindowMs: 60 * 60 * 1000,
  version: 1,
} as const;

// How long the single-use link that makes the first administrator stays valid (ADR-021 decision 8). An hour is long enough to open the
// link on the machine the operator is working at, and short enough that one left in a terminal history is soon worthless.
export const setupLinkPolicy = {
  lifetimeMs: 60 * 60 * 1000,
} as const;

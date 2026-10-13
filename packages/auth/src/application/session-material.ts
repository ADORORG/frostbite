import { sha256 } from "../domain/crypto.ts";
import type { SessionMaterial } from "./repository.ts";

// The lifetimes a new session is given.
export interface SessionLifetimes {
  readonly sessionAbsoluteLifetimeMs: number;
  readonly sessionIdleLifetimeMs: number;
}

// What is stored for a session: when it started, when it lapses, and the hash of its token (the token itself is
// never stored).
export function createSessionMaterial(
  now: Date,
  token: string,
  lifetimes: SessionLifetimes,
): SessionMaterial {
  return {
    absoluteExpiresAt: new Date(
      now.getTime() + lifetimes.sessionAbsoluteLifetimeMs,
    ),
    authenticatedAt: now,
    idleExpiresAt: new Date(now.getTime() + lifetimes.sessionIdleLifetimeMs),
    tokenHash: sha256(token),
  };
}

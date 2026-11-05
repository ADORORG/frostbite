import type { ActiveSession, SessionRepository } from "./session-repository.ts";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import { sha256 } from "../domain/crypto.ts";

export function createSessionService(dependencies: {
  readonly clock: () => Date;
  readonly idleLifetimeMs: number;
  readonly repository: SessionRepository;
}) {
  if (dependencies.idleLifetimeMs <= 0)
    throw new Error("Session idle lifetime is invalid");
  return {
    find(token: string): Promise<ActiveSession | null> {
      if (token.length === 0) return Promise.resolve(null);
      return dependencies.repository.findAndRenew({
        idleLifetimeMs: dependencies.idleLifetimeMs,
        now: dependencies.clock(),
        tokenHash: sha256(token),
      });
    },
    // Signs out the session a request came from: only that user's own, and only once.
    revokeSession(session: {
      readonly sessionId: UuidV7;
      readonly userId: UuidV7;
    }): Promise<boolean> {
      return dependencies.repository.revokeById(
        session.sessionId,
        session.userId,
        dependencies.clock(),
      );
    },
    revoke(token: string): Promise<boolean> {
      if (token.length === 0) return Promise.resolve(false);
      return dependencies.repository.revoke(
        sha256(token),
        dependencies.clock(),
      );
    },
  };
}

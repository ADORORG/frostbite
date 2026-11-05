import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import { createSessionService } from "../src/application/session-service.ts";

describe("session service policy", () => {
  it("rejects a non-positive idle lifetime", () => {
    expect(() =>
      createSessionService({
        clock: () => new Date(),
        idleLifetimeMs: 0,
        repository: {
          findAndRenew: async () => null,
          revoke: async () => false,
          revokeById: async () => false,
        },
      }),
    ).toThrow("Session idle lifetime is invalid");
  });

  it("signs out one session of one user, with the time, through the repository", async () => {
    const calls: unknown[] = [];
    const now = new Date("2026-10-13T12:00:00.000Z");
    const service = createSessionService({
      clock: () => now,
      idleLifetimeMs: 1_000,
      repository: {
        findAndRenew: async () => null,
        revoke: async () => false,
        revokeById: async (...args) => {
          calls.push(args);
          return true;
        },
      },
    });
    const session = { sessionId: createUuidV7(), userId: createUuidV7() };
    expect(await service.revokeSession(session)).toBe(true);
    expect(calls).toEqual([[session.sessionId, session.userId, now]]);
  });
});

import type { ActiveSession } from "@frostbite/auth";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import {
  resolvePageAccess,
  type PageAccessDependencies,
} from "../src/server/auth/page-access.ts";

const userId = createUuidV7();
const activeSession: ActiveSession = {
  absoluteExpiresAt: new Date("2026-09-10T00:00:00.000Z"),
  authenticatedAt: new Date("2026-09-09T00:00:00.000Z"),
  idleExpiresAt: new Date("2026-09-09T12:00:00.000Z"),
  sessionId: createUuidV7(),
  userId,
};

function dependencies(input?: {
  readonly allowed?: boolean;
  readonly failure?: boolean;
  readonly session?: ActiveSession | null;
}): PageAccessDependencies {
  return {
    findSession: vi.fn(async () => {
      if (input?.failure) throw new Error("database unavailable");
      return input?.session === undefined ? activeSession : input.session;
    }),
    forPlatform: vi.fn(async () => ({
      allowed: input?.allowed ?? false,
      policyVersion: "test-v1",
    })),
  };
}

describe("resolvePageAccess", () => {
  it("does not initialize security dependencies for cookieless routes", async () => {
    const initialize = vi.fn(() => dependencies());
    await expect(
      resolvePageAccess({ kind: "authenticated" }, undefined, initialize),
    ).resolves.toEqual({ kind: "unauthenticated" });
    expect(initialize).not.toHaveBeenCalled();
  });

  it("allows an active authenticated session", async () => {
    await expect(
      resolvePageAccess({ kind: "authenticated" }, "token", () =>
        dependencies(),
      ),
    ).resolves.toEqual({
      actorUserId: userId,
      kind: "allowed",
      session: activeSession,
    });
  });

  it("rejects an invalid or expired session", async () => {
    await expect(
      resolvePageAccess({ kind: "authenticated" }, "token", () =>
        dependencies({ session: null }),
      ),
    ).resolves.toEqual({ kind: "unauthenticated" });
  });

  it.each([true, false])(
    "maps platform authorization allowed=%s",
    async (allowed) => {
      await expect(
        resolvePageAccess(
          { capability: "platform:operate", kind: "platform" },
          "token",
          () => dependencies({ allowed }),
        ),
      ).resolves.toEqual(
        allowed
          ? { actorUserId: userId, kind: "allowed", session: activeSession }
          : { kind: "forbidden" },
      );
    },
  );

  it("fails closed when session persistence is unavailable", async () => {
    await expect(
      resolvePageAccess({ kind: "authenticated" }, "token", () =>
        dependencies({ failure: true }),
      ),
    ).resolves.toEqual({ kind: "unavailable" });
  });
});

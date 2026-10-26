import type { ActiveSession } from "@ador/auth";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import type { PageAccessDependencies } from "../src/server/auth/page-access.ts";
import { readSessionState } from "../src/server/auth/session-state.ts";

const session: ActiveSession = {
  absoluteExpiresAt: new Date("2026-09-10T00:00:00.000Z"),
  authenticatedAt: new Date("2026-09-09T00:00:00.000Z"),
  idleExpiresAt: new Date("2026-09-09T12:00:00.000Z"),
  sessionId: createUuidV7(),
  userId: createUuidV7(),
};
const dependencies =
  (
    found: () => Promise<ActiveSession | null>,
  ): (() => PageAccessDependencies) =>
  () => ({
    findSession: found,
    forPlatform: vi.fn(async () => ({ allowed: false, policyVersion: "v" })),
  });

describe("the session state the header is told", () => {
  it("is signed in for a live session", async () => {
    expect(
      await readSessionState(
        "token",
        dependencies(async () => session),
      ),
    ).toBe("signed-in");
  });

  it("is signed out with no cookie, without touching the database, and for a session that is gone", async () => {
    const initialize = vi.fn(dependencies(async () => session));
    expect(await readSessionState(undefined, initialize)).toBe("signed-out");
    expect(await readSessionState("", initialize)).toBe("signed-out");
    expect(initialize).not.toHaveBeenCalled();
    expect(
      await readSessionState(
        "expired",
        dependencies(async () => null),
      ),
    ).toBe("signed-out");
  });

  it("is unknown, not signed out, when the session could not be read", async () => {
    expect(
      await readSessionState(
        "token",
        dependencies(async () => {
          throw new Error("database unavailable");
        }),
      ),
    ).toBe("unknown");
  });
});

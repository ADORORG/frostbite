import { registerHttpOperation } from "@frostbite/http/registered-operation";
import {
  passkeyEmptyInputSchema,
  passkeyMutationResponseSchema,
} from "@frostbite/auth";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { platformSessionCookieName } from "@frostbite/shared/auth";
import { describe, expect, it, vi } from "vitest";

const setCookie = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: setCookie }),
}));
vi.mock("@repo/config/env", () => ({
  parseAuthSessionEnvironment: () => ({
    AUTH_SESSION_IDLE_TIMEOUT_MS: 86_400_000,
  }),
}));

import { executeNextOperation } from "../src/server/http/next-operation.ts";

describe("Next operation response effects", () => {
  it("sets a secure host-only cookie without exposing its token in JSON", async () => {
    const operation = registerHttpOperation({
      access: { kind: "authenticated" },
      applicationErrors: [],
      execute: async () => ({
        effects: [
          { kind: "replace-platform-session" as const, token: "secret" },
        ],
        ok: true as const,
        value: { changed: true },
      }),
      idempotency: "none",
      input: "json",
      inputSchema: passkeyEmptyInputSchema,
      method: "POST",
      operationId: "rotateSession",
      outputSchema: passkeyMutationResponseSchema,
      path: "/api/v1/rotate",
    });
    const now = new Date();
    const session = {
      absoluteExpiresAt: new Date(now.getTime() + 60_000),
      authenticatedAt: now,
      idleExpiresAt: new Date(now.getTime() + 30_000),
      sessionId: createUuidV7(),
      userId: createUuidV7(),
    };
    const response = await executeNextOperation(
      operation,
      new Request("https://launch.invalid/api/v1/rotate", { method: "POST" }),
      {},
      session,
    );
    expect(await response.json()).toEqual({ changed: true });
    expect(setCookie).toHaveBeenCalledWith(
      platformSessionCookieName,
      "secret",
      {
        httpOnly: true,
        maxAge: 86_400,
        path: "/",
        sameSite: "lax",
        secure: true,
      },
    );
  });

  it("removes the session cookie, with the same attributes it was set with, when the operation signs the browser out", async () => {
    const operation = registerHttpOperation({
      access: { kind: "authenticated" },
      applicationErrors: [],
      execute: async () => ({
        effects: [{ kind: "clear-platform-session" as const }],
        ok: true as const,
        value: { changed: true },
      }),
      idempotency: "none",
      input: "json",
      inputSchema: passkeyEmptyInputSchema,
      method: "POST",
      operationId: "signOutForTest",
      outputSchema: passkeyMutationResponseSchema,
      path: "/api/v1/sign-out-for-test",
    });
    setCookie.mockClear();
    const now = new Date();
    const response = await executeNextOperation(
      operation,
      new Request("https://launch.invalid/api/v1/sign-out-for-test", {
        method: "POST",
      }),
      {},
      {
        absoluteExpiresAt: new Date(now.getTime() + 60_000),
        authenticatedAt: now,
        idleExpiresAt: new Date(now.getTime() + 30_000),
        sessionId: createUuidV7(),
        userId: createUuidV7(),
      },
    );
    expect(await response.json()).toEqual({ changed: true });
    expect(setCookie).toHaveBeenCalledWith(platformSessionCookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });
});

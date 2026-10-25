import type { PasskeySignInService } from "@ador/auth";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import { createPasskeySignInOperations } from "../src/application/passkey-sign-in-operations.ts";

const challengeId = createUuidV7();
const expiresAt = new Date("2026-10-25T12:05:00.000Z");
const options = {
  challenge: "Y2hhbGxlbmdl",
  rpId: "launch.invalid",
  userVerification: "required" as const,
};
const credential = {
  clientExtensionResults: {},
  id: "credential-one",
  rawId: "credential-one",
  response: { authenticatorData: "a", clientDataJSON: "b", signature: "c" },
  type: "public-key" as const,
};
const context = {
  actorSession: null,
  actorUserId: null,
  correlationId: createUuidV7(),
};

function operations(
  finish: PasskeySignInService["finish"] = async () => ({
    ok: true,
    sessionToken: "session-token",
  }),
) {
  const service: PasskeySignInService = {
    begin: vi.fn(async () => ({ challengeId, expiresAt, options })),
    finish: vi.fn(finish),
  };
  return { service, ...nameThem(createPasskeySignInOperations(() => service)) };
}
function nameThem([begin, finish]: ReturnType<
  typeof createPasskeySignInOperations
>) {
  return { begin, finish };
}

describe("beginning a passkey sign-in over HTTP", () => {
  it("is open to anyone and hands the browser the challenge, its id and expiry", async () => {
    const { begin } = operations();
    expect(begin.access).toEqual({ kind: "public" });
    expect(await begin.execute({}, context)).toEqual({
      ok: true,
      value: {
        challengeId,
        expiresAt: "2026-10-25T12:05:00.000Z",
        options,
      },
    });
  });
});

describe("finishing a passkey sign-in over HTTP", () => {
  it("is open to anyone, passes only the challenge and the response on, and starts the session as a cookie, never in the body", async () => {
    const { finish, service } = operations();
    expect(finish.access).toEqual({ kind: "public" });
    const result = await finish.execute({ challengeId, credential }, context);
    expect(result).toEqual({
      effects: [{ kind: "replace-platform-session", token: "session-token" }],
      ok: true,
      value: { signedIn: true },
    });
    expect(service.finish).toHaveBeenCalledExactlyOnceWith({
      challengeId,
      payload: credential,
    });
    expect(JSON.stringify(result)).toContain("session-token");
    expect(JSON.stringify((result as { value: object }).value)).not.toContain(
      "session-token",
    );
  });

  it.each([
    "challenge-invalid",
    "credential-unknown",
    "not-verified",
    "counter-conflict",
  ] as const)(
    "tells the caller the same thing when the service says %s, so nothing shows which accounts exist",
    async (code) => {
      const { finish } = operations(async () => ({ code, ok: false }));
      expect(
        await finish.execute({ challengeId, credential }, context),
      ).toEqual({
        error: "unauthorized",
        message: "The passkey could not be verified. Try again.",
        ok: false,
      });
    },
  );

  it("declares the one failure it can return", () => {
    expect(operations().finish.applicationErrors).toEqual(["unauthorized"]);
  });
});

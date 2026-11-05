import { ApiError, type Requester } from "@frostbite/client-http";
import { describe, expect, it, vi } from "vitest";

import { failed } from "../src/client/outcome.ts";
import { apiFailure } from "./support/failures.ts";
import { signInWithPasskey } from "../src/sign-in/passkey-sign-in-flow.ts";

const challengeId = "01890f0e-7c8a-7b3a-8a3e-0123456789ab";
const options = {
  challenge: "Y2hhbGxlbmdl",
  rpId: "launch.invalid",
  userVerification: "required" as const,
};
const credential = { id: "credential-one" };

// A requester that answers each step from the real response schemas' own parse of a good answer, or fails it with an ApiError.
function server(failAt?: {
  step: 1 | 2;
  code: ApiError["code"];
  reason?: string;
}) {
  let step = 0;
  const sent: { path: string; body: object | undefined }[] = [];
  const request: Requester = async (route, schema, requestOptions) => {
    step += 1;
    sent.push({ body: requestOptions?.body, path: route.path });
    if (failAt?.step === step)
      throw apiFailure(failAt.code, failAt.reason ?? null);
    const parsed = schema.safeParse(
      step === 1
        ? {
            challengeId,
            expiresAt: "2026-10-25T12:05:00.000Z",
            options,
          }
        : { signedIn: true },
    );
    if (!parsed.success) throw new Error("fixture does not fit the contract");
    return parsed.data;
  };
  return { request, sent };
}

describe("signing in with a passkey in the browser", () => {
  it("asks the server for a challenge, lets the person choose a passkey, and sends back what it signed", async () => {
    const { request, sent } = server();
    const ask = vi.fn(async () => credential);
    expect(
      await signInWithPasskey({ ask, request, supported: () => true }),
    ).toEqual({ kind: "signed-in" });
    expect(ask).toHaveBeenCalledExactlyOnceWith(options);
    expect(sent).toEqual([
      { body: {}, path: "/api/v1/passkeys/sign-in/options" },
      {
        body: { challengeId, credential },
        path: "/api/v1/passkeys/sign-in/verify",
      },
    ]);
  });

  it("does nothing when the browser has no passkeys", async () => {
    const { request, sent } = server();
    const ask = vi.fn(async () => credential);
    expect(
      await signInWithPasskey({ ask, request, supported: () => false }),
    ).toEqual(failed("passkey-unsupported"));
    expect(sent).toHaveLength(0);
    expect(ask).not.toHaveBeenCalled();
  });

  it("says the person did not choose one, and sends nothing more, when the prompt is closed", async () => {
    const { request, sent } = server();
    const ask = vi.fn(async () => {
      throw new DOMException("closed", "NotAllowedError");
    });
    expect(
      await signInWithPasskey({ ask, request, supported: () => true }),
    ).toEqual(failed("passkey-cancelled"));
    expect(sent).toHaveLength(1);
  });

  it.each([
    [1, "network", "network"],
    [2, "network", "network"],
    [1, "internal_error", "network"],
    [2, "unauthorized", "signed-out"],
  ] as const)(
    "reports a failure at step %s (%s) as %s",
    async (step, code, expected) => {
      const { request } = server({ code, step });
      const ask = vi.fn(async () => credential);
      expect(
        await signInWithPasskey({ ask, request, supported: () => true }),
      ).toEqual(failed(expected));
      expect(ask).toHaveBeenCalledTimes(step === 1 ? 0 : 1);
    },
  );

  it("takes a failure the server did not name as a passkey that could not be verified, and uses the reason when it did", async () => {
    const ask = vi.fn(async () => credential);
    expect(
      await signInWithPasskey({
        ask,
        request: server({ code: "conflict", step: 2 }).request,
        supported: () => true,
      }),
    ).toEqual(failed("passkey-not-verified"));
    expect(
      await signInWithPasskey({
        ask,
        request: server({ code: "conflict", reason: "wallet-held", step: 2 })
          .request,
        supported: () => true,
      }),
    ).toEqual(failed("wallet-held"));
  });
});

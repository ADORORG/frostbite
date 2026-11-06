import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import { sha256 } from "../src/domain/crypto.ts";
import type {
  PasskeyAuthenticationAdapter,
  PasskeyAuthenticationPayload,
  StoredPasskeyCredential,
} from "../src/passkeys/sign-in-contracts.ts";
import type {
  PasskeySignInChallengeRecord,
  PasskeySignInRepository,
} from "../src/passkeys/sign-in-repository.ts";
import { createPasskeySignInService } from "../src/passkeys/sign-in-service.ts";

const now = new Date("2026-10-25T12:00:00.000Z");
const policy = {
  challengeLifetimeMs: 60_000,
  expectedOrigin: "https://launch.invalid",
  relyingPartyId: "launch.invalid",
  sessionAbsoluteLifetimeMs: 3_600_000,
  sessionIdleLifetimeMs: 600_000,
};
const credential: StoredPasskeyCredential = {
  counter: 4,
  credentialId: "credential-one",
  publicKey: new Uint8Array([1, 2, 3]),
  transports: ["internal"],
  userId: "user-one",
};
const payload: PasskeyAuthenticationPayload = {
  clientExtensionResults: {},
  id: "credential-one",
  rawId: "credential-one",
  response: { authenticatorData: "a", clientDataJSON: "b", signature: "c" },
  type: "public-key",
};

function harness(
  options: {
    readonly known?: StoredPasskeyCredential | null;
    readonly verifies?: { readonly counter: number } | null;
    readonly completes?: "signed-in" | "conflict";
    readonly challengeLive?: boolean;
  } = {},
) {
  const issued: PasskeySignInChallengeRecord[] = [];
  const calls: string[] = [];
  const repository: PasskeySignInRepository = {
    completeSignIn: vi.fn(async () => {
      calls.push("complete");
      return options.completes === "conflict"
        ? ({ kind: "conflict" } as const)
        : ({ kind: "signed-in", userId: "user-one" } as const);
    }),
    consumeChallenge: vi.fn(async (id) => {
      calls.push("consume");
      return options.challengeLive === false
        ? null
        : (issued.find(({ challengeId }) => challengeId === id) ?? {
            challengeHash: sha256("the-challenge"),
            challengeId: id,
            expiresAt: now,
            issuedAt: now,
            origin: policy.expectedOrigin,
            relyingPartyId: policy.relyingPartyId,
          });
    }),
    findCredential: vi.fn(async () => {
      calls.push("find");
      return options.known === undefined ? credential : options.known;
    }),
    issueChallenge: vi.fn(async (challenge) => {
      issued.push(challenge);
    }),
  };
  const adapter: PasskeyAuthenticationAdapter = {
    createOptions: vi.fn(async ({ challenge, relyingPartyId }) => ({
      challenge,
      rpId: relyingPartyId,
      userVerification: "required" as const,
    })),
    verify: vi.fn(async () => {
      calls.push("verify");
      return options.verifies === undefined ? { counter: 5 } : options.verifies;
    }),
  };
  const service = createPasskeySignInService({
    adapter,
    clock: () => now,
    policy,
    repository,
  });
  return { adapter, calls, issued, repository, service };
}

describe("beginning a passkey sign-in", () => {
  it("stores only the hash of a fresh challenge, tied to this site, for the policy's lifetime, and offers no list of credentials", async () => {
    const { issued, service } = harness();
    const begun = await service.begin();
    expect(issued).toHaveLength(1);
    const [stored] = issued;
    expect(stored).toMatchObject({
      challengeId: begun.challengeId,
      expiresAt: new Date(now.getTime() + 60_000),
      issuedAt: now,
      origin: "https://launch.invalid",
      relyingPartyId: "launch.invalid",
    });
    expect(stored?.challengeHash).toBe(sha256(begun.options.challenge));
    expect(JSON.stringify(stored)).not.toContain(begun.options.challenge);
    expect(begun.expiresAt).toEqual(stored?.expiresAt);
    expect(begun.options).not.toHaveProperty("allowCredentials");
  });

  it("gives a different challenge every time", async () => {
    const { service } = harness();
    const first = await service.begin();
    const second = await service.begin();
    expect(first.options.challenge).not.toBe(second.options.challenge);
    expect(first.challengeId).not.toBe(second.challengeId);
  });
});

describe("finishing a passkey sign-in", () => {
  const id = createUuidV7();

  it("starts a session, stores only its hash, and checks against the challenge's own origin and relying party", async () => {
    const { adapter, repository, service } = harness();
    const result = await service.finish({ challengeId: id, payload });
    if (!result.ok) throw new Error("expected a sign-in");
    expect(adapter.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeHash: sha256("the-challenge"),
        credential,
        expectedOrigin: policy.expectedOrigin,
        relyingPartyId: policy.relyingPartyId,
      }),
    );
    expect(repository.completeSignIn).toHaveBeenCalledWith({
      credentialId: "credential-one",
      expectedCounter: 4,
      newCounter: 5,
      now,
      session: expect.objectContaining({
        absoluteExpiresAt: new Date(now.getTime() + 3_600_000),
        authenticatedAt: now,
        idleExpiresAt: new Date(now.getTime() + 600_000),
        tokenHash: sha256(result.sessionToken),
      }),
    });
    expect(
      JSON.stringify(vi.mocked(repository.completeSignIn).mock.calls),
    ).not.toContain(result.sessionToken);
  });

  it("spends the challenge before looking at anything else", async () => {
    const { calls, service } = harness();
    await service.finish({ challengeId: id, payload });
    expect(calls).toEqual(["consume", "find", "verify", "complete"]);
  });

  it("refuses a challenge that is unknown, spent or expired, without looking for the credential", async () => {
    const { calls, service } = harness({ challengeLive: false });
    expect(await service.finish({ challengeId: id, payload })).toEqual({
      code: "challenge-invalid",
      ok: false,
    });
    expect(calls).toEqual(["consume"]);
  });

  it("refuses a credential nobody has, having spent the challenge anyway", async () => {
    const { calls, service } = harness({ known: null });
    expect(await service.finish({ challengeId: id, payload })).toEqual({
      code: "credential-unknown",
      ok: false,
    });
    expect(calls).toEqual(["consume", "find"]);
  });

  it("refuses a response the verifier does not accept, and starts no session", async () => {
    const { repository, service } = harness({ verifies: null });
    expect(await service.finish({ challengeId: id, payload })).toEqual({
      code: "not-verified",
      ok: false,
    });
    expect(repository.completeSignIn).not.toHaveBeenCalled();
  });

  it("refuses a response whose id and raw id differ, without asking the verifier", async () => {
    const { adapter, service } = harness();
    expect(
      await service.finish({
        challengeId: id,
        payload: { ...payload, rawId: "another" },
      }),
    ).toEqual({ code: "not-verified", ok: false });
    expect(adapter.verify).not.toHaveBeenCalled();
  });

  it("refuses when the credential's counter moved while it was being checked, and starts no session token", async () => {
    const { service } = harness({ completes: "conflict" });
    expect(await service.finish({ challengeId: id, payload })).toEqual({
      code: "counter-conflict",
      ok: false,
    });
  });
});

describe("the policy", () => {
  it.each([
    [
      "an origin that is not an origin",
      { expectedOrigin: "https://launch.invalid/path" },
    ],
    [
      "a relying party that is not the origin's host",
      { relyingPartyId: "other.invalid" },
    ],
    ["an insecure origin", { expectedOrigin: "http://launch.invalid" }],
    ["a challenge that lives no time", { challengeLifetimeMs: 0 }],
    [
      "a session that outlives its absolute limit",
      { sessionIdleLifetimeMs: 7_200_000 },
    ],
  ])("is refused at start-up for %s", (_why, change) => {
    const { adapter, repository } = harness();
    expect(() =>
      createPasskeySignInService({
        adapter,
        clock: () => now,
        policy: { ...policy, ...change },
        repository,
      }),
    ).toThrow("Passkey policy is invalid");
  });
});

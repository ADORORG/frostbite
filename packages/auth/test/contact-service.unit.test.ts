import { describe, expect, it, vi } from "vitest";

import { hashCode } from "../src/contacts/code.ts";
import { harness, heldFor, now } from "./support/contact-service-harness.ts";

describe("asking for a code", () => {
  it("stores only a salted hash, sends the code to the normalized destination, and says so", async () => {
    const { calls, deliver, repository, service } = harness();
    const result = await service.request({
      destination: " Ada@Example.com ",
      kind: "email",
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(["issue"]);
    expect(deliver).toHaveBeenCalledWith("ada@example.com", "424242");
    const [stored] = vi.mocked(repository.issue).mock.calls[0] ?? [];
    expect(stored).toMatchObject({
      destination: "ada@example.com",
      expiresAt: new Date(now.getTime() + 600_000),
      issuedAt: now,
      kind: "email",
      limits: { cooldownMs: 60_000, maximumPerWindow: 4, windowMs: 3_600_000 },
    });
    expect(stored?.codeHash).toBe(hashCode("424242", stored?.salt ?? ""));
    expect(JSON.stringify(stored)).not.toContain("424242");
  });

  it("sends nothing to a destination that cannot be one, or on a channel it does not have", async () => {
    const { deliver, repository, service } = harness();
    expect(
      await service.request({ destination: "nope", kind: "email" }),
    ).toEqual({ ok: false, reason: "invalid-destination" });
    expect(
      await service.request({ destination: "a@b.co", kind: "phone" }),
    ).toEqual({ ok: false, reason: "unsupported-channel" });
    expect(deliver).not.toHaveBeenCalled();
    expect(repository.issue).not.toHaveBeenCalled();
  });

  it.each(["cooldown", "limit"] as const)(
    "sends nothing when the repository says %s, and says when to try again",
    async (kind) => {
      const { deliver, service } = harness({
        issue: { kind, retryAfterMs: 42_000 },
      });
      expect(
        await service.request({ destination: "a@b.co", kind: "email" }),
      ).toEqual({
        ok: false,
        reason: kind,
        retryAfterMs: 42_000,
      });
      expect(deliver).not.toHaveBeenCalled();
    },
  );

  it("forgets a code that could not be delivered, and says so", async () => {
    const { calls, repository, service } = harness({
      deliver: () => Promise.reject(new Error("down")),
    });
    expect(
      await service.request({ destination: "a@b.co", kind: "email" }),
    ).toEqual({ ok: false, reason: "delivery-failed" });
    expect(calls).toEqual(["issue", "discard"]);
    const issued = vi.mocked(repository.issue).mock.calls[0]?.[0];
    expect(vi.mocked(repository.discard).mock.calls[0]?.[0]).toBe(issued?.id);
  });

  it("makes a different salt, and so a different hash, for every code", async () => {
    const { repository, service } = harness();
    await service.request({ destination: "a@b.co", kind: "email" });
    await service.request({ destination: "a@b.co", kind: "email" });
    const [first, second] = vi
      .mocked(repository.issue)
      .mock.calls.map(([input]) => input);
    expect(first?.salt).not.toBe(second?.salt);
    expect(first?.codeHash).not.toBe(second?.codeHash);
  });
});

describe("entering a code", () => {
  it("signs in on the right code, with a session whose token is not stored", async () => {
    const { repository, service } = harness({ held: heldFor("424242") });
    const result = await service.verify({
      code: "424242",
      destination: "A@b.co",
      kind: "email",
    });
    if (!result.ok) throw new Error("expected a sign-in");
    const [input] = vi.mocked(repository.completeSignIn).mock.calls[0] ?? [];
    expect(input).toMatchObject({
      accountName: "Email user",
      codeId: "code-1",
      destination: "a@b.co",
      kind: "email",
      now,
    });
    expect(input?.session.authenticatedAt).toEqual(now);
    expect(input?.session.idleExpiresAt).toEqual(
      new Date(now.getTime() + 600_000),
    );
    expect(input?.session.absoluteExpiresAt).toEqual(
      new Date(now.getTime() + 3_600_000),
    );
    expect(input?.session.tokenHash).not.toBe(result.sessionToken);
    expect(input?.session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("takes the try before comparing, with the channel's limit", async () => {
    const { repository, service } = harness({ held: heldFor("424242") });
    await service.verify({
      code: "000000",
      destination: "a@b.co",
      kind: "email",
    });
    expect(repository.takeAttempt).toHaveBeenCalledWith({
      destination: "a@b.co",
      kind: "email",
      maximumAttempts: 5,
      now,
      userId: null,
    });
  });

  it("gives the same answer for a wrong code, no live code, and a code spent in the meantime", async () => {
    const wrong = harness({ held: heldFor("424242") });
    const none = harness();
    const raced = harness({ completes: "conflict", held: heldFor("424242") });
    const answers = [
      await wrong.service.verify({
        code: "111111",
        destination: "a@b.co",
        kind: "email",
      }),
      await none.service.verify({
        code: "424242",
        destination: "a@b.co",
        kind: "email",
      }),
      await raced.service.verify({
        code: "424242",
        destination: "a@b.co",
        kind: "email",
      }),
    ];
    expect(answers).toEqual(Array(3).fill({ ok: false, reason: "invalid" }));
    expect(wrong.calls).toEqual(["take"]);
  });

  it("refuses what cannot be a code, a destination or a channel without spending a try", async () => {
    const { repository, service } = harness({ held: heldFor("424242") });
    for (const code of [
      "",
      "12345",
      "1234567",
      "12345a",
      "１２３４５６",
      " 424242",
      "424242\n",
    ])
      expect(
        await service.verify({ code, destination: "a@b.co", kind: "email" }),
      ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await service.verify({
        code: "424242",
        destination: "nope",
        kind: "email",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await service.verify({
        code: "424242",
        destination: "a@b.co",
        kind: "phone",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(repository.takeAttempt).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import { harness, heldFor, now } from "./support/contact-service-harness.ts";

describe("asking for a code to link an address to a signed-in account", () => {
  it("makes it a link code for that account, with the same limits and hash-only storage", async () => {
    const { repository, service } = harness();
    expect(
      await service.request({
        destination: "A@b.co",
        forAccount: "user-1",
        kind: "email",
      }),
    ).toEqual({ ok: true });
    const [stored] = vi.mocked(repository.issue).mock.calls[0] ?? [];
    expect(stored).toMatchObject({
      destination: "a@b.co",
      userId: "user-1",
    });
    expect(JSON.stringify(stored)).not.toContain("424242");
  });

  it("makes a sign-in code when no account is named", async () => {
    const { repository, service } = harness();
    await service.request({ destination: "a@b.co", kind: "email" });
    expect(vi.mocked(repository.issue).mock.calls[0]?.[0]).toMatchObject({
      userId: null,
    });
  });
});

describe("confirming a link code", () => {
  it("tries only a code sent for linking to this account, and gives back the code and address without spending it", async () => {
    const { repository, service } = harness({ held: heldFor("424242") });
    expect(
      await service.confirm({
        code: "424242",
        destination: " A@b.co",
        forAccount: "user-1",
        kind: "email",
      }),
    ).toEqual({
      codeId: "code-1",
      destination: "a@b.co",
      ok: true,
    });
    expect(repository.takeAttempt).toHaveBeenCalledWith({
      destination: "a@b.co",
      kind: "email",
      maximumAttempts: 5,
      now,
      userId: "user-1",
    });
    expect(repository.completeSignIn).not.toHaveBeenCalled();
  });

  it("gives one answer for a wrong code, no live code, a malformed code and an address that cannot be one", async () => {
    const wrong = harness({ held: heldFor("424242") });
    const none = harness();
    const answers = [
      await wrong.service.confirm({
        code: "111111",
        destination: "a@b.co",
        forAccount: "u",
        kind: "email",
      }),
      await none.service.confirm({
        code: "424242",
        destination: "a@b.co",
        forAccount: "u",
        kind: "email",
      }),
      await none.service.confirm({
        code: "42",
        destination: "a@b.co",
        forAccount: "u",
        kind: "email",
      }),
      await none.service.confirm({
        code: "424242",
        destination: "nope",
        forAccount: "u",
        kind: "email",
      }),
    ];
    expect(answers).toEqual(Array(4).fill({ ok: false, reason: "invalid" }));
  });
});

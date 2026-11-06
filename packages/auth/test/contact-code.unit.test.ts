import type { MailSender } from "@frostbite/mail";
import { describe, expect, it, vi } from "vitest";

import { codeMatches, generateCode, hashCode } from "../src/contacts/code.ts";
import {
  createEmailChannel,
  normalizeEmailAddress,
} from "../src/contacts/email-channel.ts";

describe("codes", () => {
  it("are made of the asked number of digits, and not always the same ones", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode(6)));
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    expect(codes.size).toBeGreaterThan(40);
    expect(generateCode(8)).toMatch(/^\d{8}$/);
  });

  it("match only their own salted hash", () => {
    const hash = hashCode("123456", "salt-a");
    expect(codeMatches("123456", "salt-a", hash)).toBe(true);
    expect(codeMatches("123457", "salt-a", hash)).toBe(false);
    expect(codeMatches("123456", "salt-b", hash)).toBe(false);
    expect(hashCode("123456", "salt-b")).not.toBe(hash);
  });

  it("do not match a hash of the wrong length", () => {
    expect(codeMatches("123456", "salt-a", "ab")).toBe(false);
    expect(codeMatches("123456", "salt-a", "")).toBe(false);
  });
});

describe("email addresses", () => {
  it("are trimmed and lower-cased, and nothing else is changed", () => {
    expect(normalizeEmailAddress("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmailAddress("a.b+tag@example.com")).toBe(
      "a.b+tag@example.com",
    );
    expect(normalizeEmailAddress("ab+tag@example.com")).not.toBe(
      normalizeEmailAddress("a.b+tag@example.com"),
    );
  });

  it("are refused when they cannot be one", () => {
    for (const bad of [
      "",
      "   ",
      "no-at-sign",
      "a@",
      "@example.com",
      "a b@example.com",
      "a@example",
      "a@@example.com",
      "a@example.com\nBcc: x@example.com",
    ])
      expect(normalizeEmailAddress(bad)).toBeNull();
  });

  it("are refused beyond the longest an address may be", () => {
    const local = "a".repeat(64);
    const longest = `${local}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`;
    expect(longest.length).toBe(254);
    expect(normalizeEmailAddress(longest)).toBe(longest);
    expect(normalizeEmailAddress(`x${longest}`)).toBeNull();
  });
});

describe("the email channel", () => {
  const policy = {
    codeLength: 6,
    lifetimeMs: 600_000,
    maximumAttempts: 5,
    maximumSendsPerWindow: 5,
    resendCooldownMs: 60_000,
    sendWindowMs: 3_600_000,
  };

  it("sends the code to the address, saying who asks, how long it lasts and what to do if it was not asked for", async () => {
    const send = vi.fn<MailSender["send"]>(() => Promise.resolve());
    const channel = createEmailChannel({
      appName: "Frostbite",
      policy,
      sender: { send },
    });
    await channel.deliver("ada@example.com", "123456");
    expect(send).toHaveBeenCalledOnce();
    const [message] = send.mock.calls[0] ?? [];
    expect(message).toMatchObject({
      subject: "123456 is your Frostbite sign-in code",
      to: "ada@example.com",
    });
    expect(message?.text).toContain("Your Frostbite sign-in code is 123456.");
    expect(message?.text).toContain("expires in 10 minutes");
    expect(message?.text).toContain("ignore this message");
    // The styled version goes with it, so a client that shows one has it.
    expect(message?.html).toContain(">123456</td>");
  });

  it("lets a failed send reach the caller", async () => {
    const channel = createEmailChannel({
      appName: "Frostbite",
      policy,
      sender: { send: () => Promise.reject(new Error("down")) },
    });
    await expect(channel.deliver("ada@example.com", "123456")).rejects.toThrow(
      "down",
    );
  });

  it("names its kind and its account, and keeps the policy it was given", () => {
    const channel = createEmailChannel({
      appName: "Frostbite",
      policy,
      sender: { send: () => Promise.resolve() },
    });
    expect(channel).toMatchObject({
      accountName: "Email user",
      kind: "email",
      policy,
    });
    expect(channel.normalize(" A@B.CO ")).toBe("a@b.co");
  });
});

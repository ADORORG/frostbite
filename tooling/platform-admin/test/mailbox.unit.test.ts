import { describe, expect, it } from "vitest";

import { formatMailbox, parseLimit } from "../src/mailbox.ts";

const message = (n: number) => ({
  from: "login@stack.invalid",
  sentAt: `2026-10-25T12:0${n}:00.000Z`,
  subject: `${n}23456 is your Frostbite sign-in code`,
  text: `Your Frostbite sign-in code is ${n}23456.\n\nIt works once.`,
  to: `person${n}@example.com`,
});

describe("printing the local mailbox", () => {
  it("says it is empty, and what to do", () => {
    expect(formatMailbox([], 5)).toContain("The mailbox is empty");
  });

  it("prints each message whole, in the order given (newest first)", () => {
    const out = formatMailbox([message(2), message(1)], 5);
    expect(out.indexOf("person2@example.com")).toBeLessThan(
      out.indexOf("person1@example.com"),
    );
    expect(out).toContain("2026-10-25T12:02:00.000Z  to person2@example.com");
    expect(out).toContain("  Subject: 223456 is your Frostbite sign-in code");
    expect(out).toContain("  Your Frostbite sign-in code is 223456.");
    expect(out).toContain("  It works once.");
    expect(out.endsWith("It works once.")).toBe(true);
  });

  it("shows only the newest few, and says how many it left out", () => {
    const out = formatMailbox([message(3), message(2), message(1)], 2);
    expect(out).toContain("person3@example.com");
    expect(out).toContain("person2@example.com");
    expect(out).not.toContain("person1@example.com");
    expect(out).toContain("(1 older messages not shown)");
  });

  it("does not mention older messages when all are shown", () => {
    expect(formatMailbox([message(1)], 1)).not.toContain("older");
  });
});

describe("the number of messages to show", () => {
  it("is five unless told otherwise, and must be a whole number of at least one", () => {
    expect(parseLimit(undefined)).toBe(5);
    expect(parseLimit("1")).toBe(1);
    expect(parseLimit("20")).toBe(20);
    for (const bad of ["0", "-1", "2.5", "many", ""])
      expect(parseLimit(bad)).toBeNull();
  });
});

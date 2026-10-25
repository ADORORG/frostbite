import { describe, expect, it } from "vitest";

import { mailSettingsSchema } from "../src/index.ts";

const smtp = {
  encryption: "starttls",
  from: "login@example.org",
  host: "smtp.example.com",
  password: "p",
  port: 587,
  timeoutMs: 1000,
  transport: "smtp",
  user: "u",
};

describe("mail settings", () => {
  it("accepts each transport with what it needs", () => {
    expect(
      mailSettingsSchema.safeParse({
        directory: "d",
        from: "f",
        transport: "capture",
      }).success,
    ).toBe(true);
    expect(mailSettingsSchema.safeParse(smtp).success).toBe(true);
  });

  it("refuses SMTP settings that are incomplete or out of range", () => {
    for (const bad of [
      { ...smtp, host: "" },
      { ...smtp, password: "" },
      { ...smtp, user: "" },
      { ...smtp, port: 0 },
      { ...smtp, port: 70_000 },
      { ...smtp, timeoutMs: 0 },
      { ...smtp, encryption: "ssl" },
    ])
      expect(mailSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses an unknown transport and stray fields", () => {
    expect(
      mailSettingsSchema.safeParse({ ...smtp, transport: "resend" }).success,
    ).toBe(false);
    expect(mailSettingsSchema.safeParse({ ...smtp, extra: 1 }).success).toBe(
      false,
    );
  });
});

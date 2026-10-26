import { describe, expect, it } from "vitest";

import {
  createSmtpSender,
  smtpTransportOptions,
  type SmtpMailSettings,
} from "../src/index.ts";

const base: SmtpMailSettings = {
  encryption: "tls",
  from: "login@example.org",
  host: "smtp.example.com",
  password: "p",
  port: 465,
  timeoutMs: 7000,
  transport: "smtp",
  user: "u",
};

describe("how the settings become connection options", () => {
  it("starts encrypted for tls, and never skips or requires an upgrade then", () => {
    expect(smtpTransportOptions(base)).toMatchObject({
      ignoreTLS: false,
      requireTLS: false,
      secure: true,
    });
  });

  it("requires the upgrade for starttls, so it never sends in the clear", () => {
    expect(
      smtpTransportOptions({ ...base, encryption: "starttls", port: 587 }),
    ).toMatchObject({
      ignoreTLS: false,
      port: 587,
      requireTLS: true,
      secure: false,
    });
  });

  it("is plain only when asked for none", () => {
    expect(smtpTransportOptions({ ...base, encryption: "none" })).toMatchObject(
      { ignoreTLS: true, requireTLS: false, secure: false },
    );
  });

  it("carries the login and bounds every wait by the timeout", () => {
    expect(smtpTransportOptions(base)).toMatchObject({
      auth: { pass: "p", user: "u" },
      connectionTimeout: 7000,
      greetingTimeout: 7000,
      host: "smtp.example.com",
      socketTimeout: 7000,
    });
  });
});

describe("a library failure with no code", () => {
  it("still fails delivery, naming no cause and none of the message", async () => {
    const sender = createSmtpSender(base, {
      sendMail: () => Promise.reject(new Error("550 ada@example.com unknown")),
    });
    const error = await sender
      .send({ subject: "s", text: "t", to: "ada@example.com" })
      .catch((caught: unknown) => caught);
    expect(String(error)).toBe(
      "MailDeliveryError: The message could not be delivered: the SMTP server failed it (unknown).",
    );
    const nonError = createSmtpSender(base, {
      sendMail: () => Promise.reject("boom"),
    });
    await expect(
      nonError.send({ subject: "s", text: "t", to: "a@example.com" }),
    ).rejects.toThrow("(unknown)");
  });
});

describe("a message with a styled version", () => {
  const sent: object[] = [];
  const transport = {
    sendMail: (mail: object) => {
      sent.push(mail);
      return Promise.resolve();
    },
  };

  it("hands the library both versions, and only the plain one when there is no other", async () => {
    const sender = createSmtpSender(base, transport);
    await sender.send({
      html: "<p>h</p>",
      subject: "s",
      text: "t",
      to: "a@example.com",
    });
    await sender.send({ subject: "s", text: "t", to: "a@example.com" });
    expect(sent[0]).toMatchObject({ html: "<p>h</p>", text: "t" });
    expect(sent[1]).toStrictEqual({
      from: base.from,
      subject: "s",
      text: "t",
      to: "a@example.com",
    });
  });
});

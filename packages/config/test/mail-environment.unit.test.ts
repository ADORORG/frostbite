import { describe, expect, it } from "vitest";

import { parseMailEnvironment } from "../src/env/mail.ts";

const app = {
  APP_ENV: "local",
  NEXT_PUBLIC_APP_NAME: "Ador",
  PUBLIC_BASE_URL: "http://localhost:3000",
};
const smtp = {
  ...app,
  MAIL_FROM_ADDRESS: "login@example.org",
  MAIL_SMTP_ENCRYPTION: "starttls",
  MAIL_SMTP_HOST: "smtp.example.com",
  MAIL_SMTP_PASSWORD: "pw-1",
  MAIL_SMTP_PORT: "587",
  MAIL_SMTP_USER: "mailer",
  MAIL_TRANSPORT: "smtp",
};

describe("the mail environment", () => {
  it("is absent, not an error, while no transport is set", () => {
    expect(parseMailEnvironment(app)).toBeNull();
    expect(parseMailEnvironment({ ...app, MAIL_TRANSPORT: "  " })).toBeNull();
  });

  it("reads the capture transport with its directory", () => {
    expect(
      parseMailEnvironment({
        ...app,
        MAIL_CAPTURE_DIRECTORY: " /srv/mail ",
        MAIL_FROM_ADDRESS: "login@example.org",
        MAIL_TRANSPORT: "capture",
      }),
    ).toEqual({
      directory: "/srv/mail",
      from: "login@example.org",
      transport: "capture",
    });
  });

  it("reads an SMTP server with the standard timeout unless one is given", () => {
    const expected = {
      encryption: "starttls",
      from: "login@example.org",
      host: "smtp.example.com",
      password: "pw-1",
      port: 587,
      timeoutMs: 10_000,
      transport: "smtp",
      user: "mailer",
    };
    expect(parseMailEnvironment(smtp)).toEqual(expected);
    expect(parseMailEnvironment({ ...smtp, MAIL_TIMEOUT_MS: "3000" })).toEqual({
      ...expected,
      timeoutMs: 3000,
    });
  });

  it("stops boot on a transport that cannot work", () => {
    const without = (key: keyof typeof smtp) => ({ ...smtp, [key]: "" });
    expect(() =>
      parseMailEnvironment({ ...smtp, MAIL_TRANSPORT: "sendgrid" }),
    ).toThrow();
    expect(() => parseMailEnvironment(without("MAIL_FROM_ADDRESS"))).toThrow(
      "MAIL_FROM_ADDRESS",
    );
    for (const key of [
      "MAIL_SMTP_HOST",
      "MAIL_SMTP_PORT",
      "MAIL_SMTP_USER",
      "MAIL_SMTP_PASSWORD",
      "MAIL_SMTP_ENCRYPTION",
    ] as const)
      expect(() => parseMailEnvironment(without(key))).toThrow();
    expect(() =>
      parseMailEnvironment({ ...smtp, MAIL_SMTP_ENCRYPTION: "ssl" }),
    ).toThrow();
    expect(() =>
      parseMailEnvironment({ ...smtp, MAIL_SMTP_PORT: "99999" }),
    ).toThrow();
    expect(() =>
      parseMailEnvironment({ ...smtp, MAIL_TIMEOUT_MS: "0" }),
    ).toThrow();
    expect(() =>
      parseMailEnvironment({
        ...app,
        MAIL_FROM_ADDRESS: "a@example.org",
        MAIL_TRANSPORT: "capture",
      }),
    ).toThrow();
  });

  it.each(["preview", "production"])(
    "refuses capture where real people sign in (%s)",
    (APP_ENV) => {
      expect(() =>
        parseMailEnvironment({
          ...app,
          APP_ENV,
          MAIL_CAPTURE_DIRECTORY: "/srv/mail",
          MAIL_FROM_ADDRESS: "login@example.org",
          MAIL_TRANSPORT: "capture",
        }),
      ).toThrow("not allowed");
    },
  );

  it.each(["preview", "production"])(
    "refuses an unencrypted SMTP connection there (%s), and accepts the encrypted ones",
    (APP_ENV) => {
      const base = { ...smtp, APP_ENV };
      expect(() =>
        parseMailEnvironment({ ...base, MAIL_SMTP_ENCRYPTION: "none" }),
      ).toThrow("clear");
      expect(
        parseMailEnvironment({ ...base, MAIL_SMTP_ENCRYPTION: "tls" }),
      ).toMatchObject({ encryption: "tls" });
      expect(parseMailEnvironment(base)).toMatchObject({
        encryption: "starttls",
      });
    },
  );

  it("allows an unencrypted connection on a developer's machine, for a stand-in server", () => {
    expect(
      parseMailEnvironment({ ...smtp, MAIL_SMTP_ENCRYPTION: "none" }),
    ).toMatchObject({ encryption: "none" });
  });
});

import { describe, expect, it } from "vitest";

import {
  describeMail,
  mailEnvironmentFrom,
} from "../src/stack-mail-environment.ts";

const data = "/data/.stack-data";
const captured = {
  MAIL_CAPTURE_DIRECTORY: "/data/.stack-data/mailbox",
  MAIL_FROM_ADDRESS: "login@stack.invalid",
  MAIL_TRANSPORT: "capture",
};
const smtp = [
  "MAIL_TRANSPORT=smtp",
  "MAIL_FROM_ADDRESS=noreply@example.test",
  "MAIL_SMTP_HOST=smtp.example.test",
  "MAIL_SMTP_PORT=587",
  "MAIL_SMTP_ENCRYPTION=starttls",
  "MAIL_SMTP_USER=user",
  "MAIL_SMTP_PASSWORD=hunter2",
  "MAIL_TIMEOUT_MS=",
  "MAIL_CAPTURE_DIRECTORY=",
  "REWARDS_CHAIN_RPC_URL=https://node.example.test",
].join("\n");

describe("the stack's mail settings", () => {
  it("captures mail when nothing was chosen: no file, a file without a transport, or a blank one", () => {
    expect(mailEnvironmentFrom(null, {}, data)).toEqual(captured);
    expect(mailEnvironmentFrom("BETA_NETWORK=signet", {}, data)).toEqual(
      captured,
    );
    expect(
      mailEnvironmentFrom("MAIL_TRANSPORT=\nMAIL_SMTP_HOST=x", {}, data),
    ).toEqual(captured);
  });

  it("uses every non-blank MAIL_ setting of the file, and only those, when a transport is chosen", () => {
    expect(mailEnvironmentFrom(smtp, {}, data)).toEqual({
      MAIL_FROM_ADDRESS: "noreply@example.test",
      MAIL_SMTP_ENCRYPTION: "starttls",
      MAIL_SMTP_HOST: "smtp.example.test",
      MAIL_SMTP_PASSWORD: "hunter2",
      MAIL_SMTP_PORT: "587",
      MAIL_SMTP_USER: "user",
      MAIL_TRANSPORT: "smtp",
    });
  });

  it("lets a setting in the shell win over the file, and a transport in the shell alone is a choice too", () => {
    expect(
      mailEnvironmentFrom(smtp, { MAIL_SMTP_PORT: "2525" }, data),
    ).toMatchObject({
      MAIL_SMTP_HOST: "smtp.example.test",
      MAIL_SMTP_PORT: "2525",
    });
    expect(
      mailEnvironmentFrom(null, { MAIL_TRANSPORT: "smtp", PATH: "/bin" }, data),
    ).toEqual({ MAIL_TRANSPORT: "smtp" });
    expect(
      mailEnvironmentFrom("MAIL_TRANSPORT=smtp", { MAIL_TRANSPORT: "" }, data),
    ).toEqual(captured);
  });
});

describe("what the stack says about mail", () => {
  it("says real mail is really sent, naming the host and sender and never the password", () => {
    const line = describeMail(mailEnvironmentFrom(smtp, {}, data));
    expect(line).toContain("REALLY SENT");
    expect(line).toContain("smtp.example.test");
    expect(line).toContain("noreply@example.test");
    expect(line).not.toContain("hunter2");
  });

  it("says captured mail is not sent and how to read it", () => {
    const line = describeMail(captured);
    expect(line).toContain("not sent");
    expect(line).toContain("pnpm mailbox");
  });
});

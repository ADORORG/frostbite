import { afterEach, describe, expect, it } from "vitest";

import {
  MailDeliveryError,
  createMailSender,
  type SmtpMailSettings,
} from "../src/index.ts";
import { startSilentServer, startSmtpServer } from "./support/smtp-world.ts";

const message = { subject: "Your code", text: "123456", to: "ada@example.com" };
const login = { password: "s3cret-pass", user: "mailer" };

function settings(
  port: number,
  overrides: Partial<SmtpMailSettings> = {},
): SmtpMailSettings {
  return {
    encryption: "none",
    from: "login@example.org",
    host: "127.0.0.1",
    port,
    timeoutMs: 2000,
    transport: "smtp",
    ...login,
    ...overrides,
  };
}
const dependencies = { clock: () => new Date(0) };
const send = (config: SmtpMailSettings) =>
  createMailSender(config, dependencies).send(message);

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(stops.splice(0).map((stop) => stop()));
});
async function server(
  options: { offerStartTls?: boolean; refuseRecipient?: string } = {},
) {
  const started = await startSmtpServer({ ...login, ...options });
  stops.push(started.close);
  return started;
}

describe("sending through an SMTP server", () => {
  it("logs in and gives the server the sender, the one recipient, the subject and the text", async () => {
    const smtp = await server();
    await send(settings(smtp.port));
    expect(smtp.received).toHaveLength(1);
    const [got] = smtp.received;
    expect(got?.user).toBe("mailer");
    expect(got?.from).toBe("login@example.org");
    expect(got?.to).toEqual(["ada@example.com"]);
    expect(got?.data).toContain("Subject: Your code");
    expect(got?.data).toContain("123456");
  });

  it("fails a wrong password, without the password or the address in the error", async () => {
    const smtp = await server();
    const error = await send(
      settings(smtp.port, { password: "wrong-pass" }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MailDeliveryError);
    expect(String(error)).toContain("EAUTH");
    expect(String(error)).not.toContain("wrong-pass");
    expect(String(error)).not.toContain("ada@example.com");
    expect(smtp.received).toHaveLength(0);
  });

  it("fails when the server refuses the recipient", async () => {
    const smtp = await server({ refuseRecipient: "ada@example.com" });
    const error = await send(settings(smtp.port)).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(MailDeliveryError);
    expect(String(error)).not.toContain("ada@example.com");
    expect(smtp.received).toHaveLength(0);
  });

  it("refuses to send in the clear when encryption was required and the server cannot upgrade", async () => {
    const smtp = await server({ offerStartTls: false });
    await expect(
      send(settings(smtp.port, { encryption: "starttls" })),
    ).rejects.toBeInstanceOf(MailDeliveryError);
    expect(smtp.received).toHaveLength(0);
  });

  it("fails when nothing is listening", async () => {
    const smtp = await server();
    const { port } = smtp;
    await smtp.close();
    stops.length = 0;
    await expect(send(settings(port))).rejects.toThrow(
      "the SMTP server failed it",
    );
  });

  it("gives up on a server that never answers, within the timeout", async () => {
    const silent = await startSilentServer();
    stops.push(silent.close);
    const started = Date.now();
    await expect(
      send(settings(silent.port, { timeoutMs: 150 })),
    ).rejects.toThrow("ETIMEDOUT");
    expect(Date.now() - started).toBeLessThan(1500);
  });
});

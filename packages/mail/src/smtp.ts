import { createTransport } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import {
  MailDeliveryError,
  type MailSender,
  type SmtpMailSettings,
} from "./contracts.ts";

// How each protection maps to the library's connection options. `starttls` also sets `requireTLS`: without it the library would send
// in the clear to a server that does not offer the upgrade.
export function smtpTransportOptions(
  settings: SmtpMailSettings,
): SMTPTransport.Options {
  return {
    auth: { pass: settings.password, user: settings.user },
    connectionTimeout: settings.timeoutMs,
    greetingTimeout: settings.timeoutMs,
    host: settings.host,
    ignoreTLS: settings.encryption === "none",
    port: settings.port,
    requireTLS: settings.encryption === "starttls",
    secure: settings.encryption === "tls",
    socketTimeout: settings.timeoutMs,
  };
}

// Sends through an SMTP server. The library's error text can hold the address or what the server said, so only its short code (such as
// EAUTH or ETIMEDOUT) reaches the error.
// The one call this makes of the library, so a test can stand in for a library that fails in a way a real server will not.
export interface SmtpTransport {
  sendMail(mail: {
    readonly from: string;
    readonly html?: string;
    readonly subject: string;
    readonly text: string;
    readonly to: string;
  }): Promise<unknown>;
}

export function createSmtpSender(
  settings: SmtpMailSettings,
  transport: SmtpTransport = createTransport(smtpTransportOptions(settings)),
): MailSender {
  return {
    async send(message) {
      try {
        // With one recipient the library rejects when the server refuses it, so a resolved send is an accepted one.
        await transport.sendMail({
          from: settings.from,
          ...(message.html === undefined ? {} : { html: message.html }),
          subject: message.subject,
          text: message.text,
          to: message.to,
        });
      } catch (error) {
        const code =
          error instanceof Error &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : "unknown";
        throw new MailDeliveryError(`the SMTP server failed it (${code}).`);
      }
    },
  };
}

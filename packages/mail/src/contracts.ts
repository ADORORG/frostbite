import { z } from "zod";

// What the platform asks of whatever delivers its mail. A provider is an adapter behind this port (`MailSender`): nothing that sends a
// message names a provider, and a provider names nothing of the platform.
export interface MailMessage {
  readonly subject: string;
  // A styled version for clients that show one. Optional, and the caller owns what is in it: it must be self-contained (inline styles,
  // no script, no remote image or link), so it cannot track or imitate anything. `text` is always required and always says all of it.
  readonly html?: string;
  readonly text: string;
  // One recipient address, already normalized by the caller.
  readonly to: string;
}

export interface MailSender {
  // Resolves once the provider has accepted the message for delivery. Rejects with `MailDeliveryError` when it has not, so a caller
  // never treats a message that went nowhere as sent.
  send(message: MailMessage): Promise<void>;
}

// A failed delivery. The reason never holds an address, a key or anything the provider said about the message: only what kind of
// failure it was, so it is safe to log.
export class MailDeliveryError extends Error {
  constructor(reason: string, options?: { readonly cause: unknown }) {
    super(`The message could not be delivered: ${reason}`, options);
    this.name = "MailDeliveryError";
  }
}

// How the connection to an SMTP server is protected. `tls` starts encrypted (usually port 465); `starttls` upgrades and refuses to send
// if the server cannot; `none` sends in the clear and exists only for a stand-in server on a developer's machine (the environment
// parser refuses it in preview and production).
export const smtpEncryptions = ["none", "starttls", "tls"] as const;

// The mail a deployment is set up for: one transport and what it needs.
// - `smtp` is any SMTP server: Resend, Postmark and ZeptoMail all offer one, so switching provider is a change of host, user and password
//   and not of code.
// - `capture` writes each message to a directory instead of sending it, for development and tests; the environment parser refuses it
//   in preview and production.
// Another way of sending (a provider's HTTP API) adds a member here and one case in `createMailSender`.
export const mailSettingsSchema = z.discriminatedUnion("transport", [
  z.strictObject({
    directory: z.string().min(1),
    from: z.string().min(1),
    transport: z.literal("capture"),
  }),
  z.strictObject({
    encryption: z.enum(smtpEncryptions),
    from: z.string().min(1),
    host: z.string().min(1),
    password: z.string().min(1),
    port: z.number().int().min(1).max(65_535),
    // Every wait on the server (connecting, greeting, each reply) is bounded by this.
    timeoutMs: z.number().int().positive(),
    transport: z.literal("smtp"),
    user: z.string().min(1),
  }),
]);
export type MailSettings = z.infer<typeof mailSettingsSchema>;
export type SmtpMailSettings = Extract<MailSettings, { transport: "smtp" }>;
export type MailTransport = MailSettings["transport"];

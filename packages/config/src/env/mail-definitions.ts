import type { EnvironmentDefinition } from "./definitions.ts";

// The mail settings (ADR-021 point 9), kept apart from the other definitions to keep each file small. `parseMailEnvironment` reads them.
export const mailEnvironmentDefinitions = [
  {
    key: "MAIL_TRANSPORT",
    description:
      "How the platform sends mail: smtp (any SMTP server; Resend, Postmark and ZeptoMail all offer one) or capture (writes each message to MAIL_CAPTURE_DIRECTORY and delivers nothing; refused in preview and production). Blank means no mail, and sign-in by email is not offered.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "MAIL_FROM_ADDRESS",
    description:
      "The sender address on every message (on a domain the provider has verified: SPF and DKIM). Required when MAIL_TRANSPORT is set.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "MAIL_SMTP_HOST",
    description:
      "The SMTP server's host name. Required for smtp. Take it from the provider's SMTP documentation.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "MAIL_SMTP_PORT",
    description:
      "The SMTP server's port (465 for tls, 587 for starttls are the usual ones). Required for smtp.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "MAIL_SMTP_ENCRYPTION",
    description:
      "tls (encrypted from the start), starttls (upgrades, and refuses to send if the server cannot) or none (plain; for a stand-in server on a developer's machine, refused in preview and production). Required for smtp.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "MAIL_SMTP_USER",
    description: "The SMTP login name the provider gives. Required for smtp.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "MAIL_SMTP_PASSWORD",
    description:
      "The SMTP password the provider gives (often an API key or token). Required for smtp.",
    exposure: "server",
    required: false,
    secret: true,
  },
  {
    key: "MAIL_TIMEOUT_MS",
    description:
      "Milliseconds before a wait on the mail server gives up; blank means 10000.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "MAIL_CAPTURE_DIRECTORY",
    description:
      "Directory the capture transport writes messages to (read them with pnpm mailbox). Required for capture.",
    exposure: "server",
    required: false,
    secret: false,
  },
] as const satisfies readonly EnvironmentDefinition[];

# `@ador/mail`

The mail port and its senders. Anything that sends a message depends on `MailSender`; a sender is chosen by settings, not by code.

## Public API

- `MailSender`, `MailMessage`, `MailDeliveryError`: the port. A message is one recipient, a subject and plain text. `send` resolves
  only when the server accepted the message and rejects with `MailDeliveryError` otherwise. The error holds no address, password or
  server text (only a short code such as `EAUTH` or `ETIMEDOUT`), so it is safe to log.
- `mailSettingsSchema`, `MailSettings`: one member per transport. `createMailSender(settings, { clock })` builds the sender.
- `smtp`: any SMTP server, through [Nodemailer](https://nodemailer.com/smtp). This is how the provider is chosen. Resend, Postmark and
  ZeptoMail each document an SMTP host, port, login and password; switching between them (or to another) is a change of
  `MAIL_SMTP_*` settings and no code. The usual encryptions are `tls` (port 465) and `starttls` (587); `starttls` refuses to send if
  the server cannot upgrade, so a login and a code never cross the network in the clear by accident.
- `capture`: writes each message as a JSON file in a directory instead of sending it. `readCapturedMail(directory)` lists them newest
  first; `pnpm mailbox` prints them. For development and tests.

The environment parser refuses `capture` and `smtp` with encryption `none` in preview and production.

## Adding another way of sending

A member in `mailSettingsSchema` and one case in `createMailSender` (for example a provider's HTTP API, if SMTP ever falls short).

## Configuration

`MAIL_TRANSPORT`, `MAIL_FROM_ADDRESS`, `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_ENCRYPTION`, `MAIL_SMTP_USER`,
`MAIL_SMTP_PASSWORD` (secret), `MAIL_TIMEOUT_MS`, `MAIL_CAPTURE_DIRECTORY`. Read and validated in `@repo/config/env`
(`parseMailEnvironment`); this package reads no environment. The sender address must be on a domain the provider has verified (SPF and
DKIM), or messages are filtered as spam.

## Invariants

- A message never counts as sent until the server accepted it.
- Every wait on the server (connecting, greeting, replies) is bounded by `timeoutMs`.
- Errors never repeat what the server or the library said, because that can contain the recipient.

## Tests

`pnpm --filter @ador/mail test:unit`, `test:integration` (real files, and a real SMTP server on a local port), `test:coverage`.

## Ownership

Platform engineering.

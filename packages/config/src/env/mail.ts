import { mailSettingsSchema, type MailSettings } from "@ador/mail";
import { z } from "zod";

import { parseEnvironment } from "./runtime.ts";

const blankAsUnset = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

const DEFAULT_MAIL_TIMEOUT_MS = 10_000;

const transportSchema = z.enum(["capture", "smtp"]);

// The mail the deployment is set up for, or null when none is: with no transport the platform sends nothing, and the pages do not
// offer a sign-in that needs mail. A transport that cannot work (no sender address, no login) stops boot rather than failing at the
// first person's attempt. Capture writes files instead of sending, and an unencrypted SMTP connection sends a login and a sign-in
// code in the clear, so both are refused wherever real people sign in.
export function parseMailEnvironment(
  source: NodeJS.ProcessEnv,
): MailSettings | null {
  const transportText = blankAsUnset(source.MAIL_TRANSPORT);
  if (transportText === undefined) return null;
  const transport = transportSchema.parse(transportText);
  const { APP_ENV } = parseEnvironment(source);
  const strict = APP_ENV === "preview" || APP_ENV === "production";
  const from = z
    .string({
      error: "MAIL_FROM_ADDRESS is required when MAIL_TRANSPORT is set.",
    })
    .parse(blankAsUnset(source.MAIL_FROM_ADDRESS));
  if (transport === "capture") {
    if (strict)
      throw new Error(
        `MAIL_TRANSPORT=capture writes messages to a directory and delivers nothing; it is not allowed when APP_ENV is ${APP_ENV}.`,
      );
    return mailSettingsSchema.parse({
      directory: blankAsUnset(source.MAIL_CAPTURE_DIRECTORY),
      from,
      transport,
    });
  }
  const encryption = blankAsUnset(source.MAIL_SMTP_ENCRYPTION);
  if (strict && encryption === "none")
    throw new Error(
      `MAIL_SMTP_ENCRYPTION=none sends the login and the codes in the clear; it is not allowed when APP_ENV is ${APP_ENV}.`,
    );
  return mailSettingsSchema.parse({
    encryption,
    from,
    host: blankAsUnset(source.MAIL_SMTP_HOST),
    password: blankAsUnset(source.MAIL_SMTP_PASSWORD),
    port: z.coerce.number().int().parse(blankAsUnset(source.MAIL_SMTP_PORT)),
    timeoutMs: z.coerce
      .number()
      .int()
      .parse(blankAsUnset(source.MAIL_TIMEOUT_MS) ?? DEFAULT_MAIL_TIMEOUT_MS),
    transport,
    user: blankAsUnset(source.MAIL_SMTP_USER),
  });
}

import type { MailSender } from "@ador/mail";
import { z } from "zod";

import type { ContactChannel, ContactCodePolicy } from "./channel.ts";

export const emailMethodKind = "email";

// The longest an address may be (RFC 5321 section 4.5.3.1.3: 254 once the angle brackets are left out).
const MAXIMUM_ADDRESS_LENGTH = 254;
const MS_PER_MINUTE = 60_000;

const addressSchema = z.email().max(MAXIMUM_ADDRESS_LENGTH);

// Lower case and trimmed; nothing else is changed, because dots and "+tags" can name different mailboxes (ADR-021 point 9).
export function normalizeEmailAddress(raw: string): string | null {
  const parsed = addressSchema.safeParse(raw.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}

export function createEmailChannel(dependencies: {
  readonly appName: string;
  readonly policy: ContactCodePolicy;
  readonly sender: MailSender;
}): ContactChannel {
  const { appName, policy, sender } = dependencies;
  const minutes = Math.round(policy.lifetimeMs / MS_PER_MINUTE);
  return {
    accountName: "Email user",
    deliver: (destination, code) =>
      sender.send({
        subject: `${code} is your ${appName} sign-in code`,
        text: [
          `Your ${appName} sign-in code is ${code}.`,
          "",
          `It works once and expires in ${minutes} minutes. If you did not ask for it, ignore this message: nobody can sign in without the code.`,
        ].join("\n"),
        to: destination,
      }),
    kind: emailMethodKind,
    normalize: normalizeEmailAddress,
    policy,
  };
}

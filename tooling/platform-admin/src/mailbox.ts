import type { CapturedMail } from "@ador/mail";

// What the person testing is shown of the messages the capture transport kept: when, to whom, and the message itself, newest first. A
// local mailbox has no one else to read it, so the text (and with it the code) is printed whole.
export function formatMailbox(
  mail: readonly CapturedMail[],
  limit: number,
): string {
  if (mail.length === 0)
    return "The mailbox is empty. Ask for a code on the sign-in page, then run this again.";
  const shown = mail.slice(0, limit);
  const lines = shown.flatMap(({ sentAt, subject, text, to }) => [
    `${sentAt}  to ${to}`,
    `  Subject: ${subject}`,
    ...text.split("\n").map((line) => `  ${line}`),
    "",
  ]);
  if (mail.length > shown.length)
    lines.push(`(${mail.length - shown.length} older messages not shown)`);
  return lines.join("\n").trimEnd();
}

export const DEFAULT_MAILBOX_LIMIT = 5;

// How many messages to show: a whole number of at least 1, or null when what was typed is not one.
export function parseLimit(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_MAILBOX_LIMIT;
  const limit = Number(raw);
  return Number.isInteger(limit) && limit >= 1 ? limit : null;
}

import { parseEnv } from "node:util";

import { captureMailEnvironment } from "./manual-stack.ts";

// Mail in the local stack is captured to files (`pnpm mailbox` reads them) unless the developer has chosen otherwise: a `MAIL_TRANSPORT` in
// the app's own settings file (or the shell) is that choice, so the stack then uses every `MAIL_*` setting found there and really sends. The
// choice is explicit, which keeps the stack from reaching a real mail service by accident; with none, nothing leaves the machine.
const isMailSetting = (key: string) => key.startsWith("MAIL_");

export function mailEnvironmentFrom(
  fileText: string | null,
  shell: NodeJS.ProcessEnv,
  dataDirectory: string,
): NodeJS.ProcessEnv {
  const settings: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    fileText === null ? {} : parseEnv(fileText),
  )) {
    if (!isMailSetting(key) || key in shell) continue;
    if (value !== undefined && value.trim() !== "") settings[key] = value;
  }
  for (const [key, value] of Object.entries(shell)) {
    if (isMailSetting(key) && value !== undefined && value.trim() !== "")
      settings[key] = value;
  }
  return settings.MAIL_TRANSPORT === undefined
    ? captureMailEnvironment(dataDirectory)
    : settings;
}

// What the stack says about mail, in words and never with the password: where messages go.
export function describeMail(environment: NodeJS.ProcessEnv): string {
  if (environment.MAIL_TRANSPORT === "smtp")
    return `Mail: REALLY SENT through ${environment.MAIL_SMTP_HOST ?? "an unset host"} as ${environment.MAIL_FROM_ADDRESS ?? "an unset sender"} (MAIL_TRANSPORT=smtp in your settings).`;
  return "Mail: captured to files, not sent. Read sign-in codes with `pnpm mailbox`.";
}

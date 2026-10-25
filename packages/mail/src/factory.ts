import { createCapturingMailbox } from "./capture.ts";
import type { MailSender, MailSettings } from "./contracts.ts";
import { createSmtpSender } from "./smtp.ts";

// The sender a deployment's settings call for. Switching provider is a change of settings, not of code.
export function createMailSender(
  settings: MailSettings,
  dependencies: { readonly clock: () => Date },
): MailSender {
  switch (settings.transport) {
    case "capture":
      return createCapturingMailbox({
        clock: dependencies.clock,
        directory: settings.directory,
        from: settings.from,
      });
    case "smtp":
      return createSmtpSender(settings);
  }
}

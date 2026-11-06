import {
  createContactCodeService,
  createContactLinkService,
  createDrizzleContactCodeRepository,
  createDrizzleContactLinkRepository,
  createEmailChannel,
  type ContactCodePolicy,
  type ContactCodeService,
  type ContactLinkService,
} from "@frostbite/auth";
import { createMailSender, type MailSettings } from "@frostbite/mail";
import {
  parseAuthSessionEnvironment,
  parseEnvironment,
} from "@repo/config/env";

import type { AccountMethods } from "./runtime.ts";
import { database } from "./shared-database.ts";

// What signing in by email needs of the platform's configuration: how mail is sent and the code policy. Supplied by the composition
// root, never read here; `null` means the deployment has no mail, and the email routes answer that they are not available.
export interface EmailSignInRules {
  readonly mail: MailSettings;
  readonly policy: ContactCodePolicy;
}

// The email services, made when a request first needs them: the one-time-code service (signing in) and the link service (adding and
// removing an address on a signed-in account), over one channel and one sender. With no mail there is no channel at all, so asking for a
// code is refused as unsupported and nothing is stored.
// `maximumAddresses` is the most email addresses one account may hold. It is the platform's rule whether or not mail is set up (an account
// can hold addresses, and the list route reports the limit, on any deployment), so it does not come with the mail rules.
export function createEmailResolvers(
  rules: EmailSignInRules | null,
  methods: AccountMethods,
  maximumAddresses: number,
): {
  readonly codes: () => ContactCodeService;
  readonly links: () => ContactLinkService;
} {
  let built:
    { codes: ContactCodeService; links: ContactLinkService } | undefined;
  function build() {
    if (built) return built;
    const clock = () => new Date();
    const environment = parseAuthSessionEnvironment(process.env);
    const sessions = {
      sessionAbsoluteLifetimeMs: environment.AUTH_SESSION_ABSOLUTE_TIMEOUT_MS,
      sessionIdleLifetimeMs: environment.AUTH_SESSION_IDLE_TIMEOUT_MS,
    };
    const channels =
      rules === null
        ? []
        : [
            createEmailChannel({
              appName: parseEnvironment(process.env).NEXT_PUBLIC_APP_NAME,
              policy: rules.policy,
              sender: createMailSender(rules.mail, { clock }),
            }),
          ];
    const codes = createContactCodeService({
      channels,
      clock,
      repository: createDrizzleContactCodeRepository(database()),
      sessions,
    });
    built = {
      codes,
      links: createContactLinkService({
        channels,
        clock,
        codes,
        policy: {
          ...sessions,
          maximumAddresses,
          recentAuthenticationWindowMs:
            environment.PASSKEY_RECENT_AUTH_WINDOW_MS,
        },
        repository: createDrizzleContactLinkRepository(
          database(),
          methods.list,
        ),
      }),
    };
    return built;
  }
  return { codes: () => build().codes, links: () => build().links };
}

import {
  createContactCodeService,
  createContactLinkService,
  createDrizzleContactCodeRepository,
  createDrizzleContactLinkRepository,
  createEmailChannel,
  type ContactCodePolicy,
  type ContactCodeService,
  type ContactLinkService,
  createDrizzlePasskeyRepository,
  createDrizzlePasskeySignInRepository,
  createPasskeySignInService,
  simpleWebAuthnAuthenticationAdapter,
  type PasskeySignInService,
  createDrizzleSessionRepository,
  createDrizzleWalletAuthRepository,
  createDrizzleWalletMethodsRepository,
  createPasskeyLinkingService,
  createSessionService,
  createWalletAuthService,
  createWalletMethodsService,
  simpleWebAuthnRegistrationAdapter,
  strictBip322Verifier,
  type MethodRegistry,
} from "@ador/auth";
import {
  createDrizzleSetupLinks,
  createSetupLinkService,
  type RoleRequirements,
  type SetupLinkService,
} from "@ador/authorization";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  type DatabaseTransaction,
} from "@ador/database/connection";
import { createMailSender, type MailSettings } from "@ador/mail";
import { randomBytes } from "node:crypto";

import { createHeldMethodKinds } from "./held-method-kinds.ts";
import type { WalletAuthServices } from "./application/wallet-services.ts";
import type { WalletAuthConfig } from "./wallet-config.ts";
import {
  parseAuthSessionEnvironment,
  parseEnvironment,
} from "@repo/config/env";

let sharedDatabase: ReturnType<typeof createDatabaseClient> | undefined;

// The sign-in methods the deployment offers (composed once, in the platform's configuration) as this feature uses them.
export type AccountMethods = MethodRegistry<DatabaseTransaction>;
type PasskeyService = ReturnType<typeof createPasskeyLinkingService>;

// The kinds of method the sign-in page may offer: those registered that can start a session, in registration order.
export function offeredSignInKinds(methods: AccountMethods): readonly string[] {
  return methods
    .describe()
    .filter(({ canSignIn }) => canSignIn)
    .map(({ kind }) => kind);
}

// One connection pool for everything this feature does, made when something first needs it.
function database() {
  sharedDatabase ??= createDatabaseClient(
    createDatabasePool(parseDatabaseEnvironment(process.env)),
  );
  return sharedDatabase;
}

// The passkey service, made when a request first needs it.
export function createPasskeyServiceResolver(
  methods: AccountMethods,
): () => PasskeyService {
  let service: PasskeyService | undefined;
  return () => {
    if (service) return service;
    service = buildPasskeyService(methods);
    return service;
  };
}

// The passkey policy both services (linking and signing in) run under: the relying party is the host of the platform's own address.
function passkeyPolicy() {
  const app = parseEnvironment(process.env);
  const policy = parseAuthSessionEnvironment(process.env);
  const origin = new URL(app.PUBLIC_BASE_URL);
  return {
    challengeLifetimeMs: policy.PASSKEY_CHALLENGE_TIMEOUT_MS,
    expectedOrigin: origin.origin,
    recentAuthenticationWindowMs: policy.PASSKEY_RECENT_AUTH_WINDOW_MS,
    relyingPartyId: origin.hostname,
    relyingPartyName: app.NEXT_PUBLIC_APP_NAME,
    sessionAbsoluteLifetimeMs: policy.AUTH_SESSION_ABSOLUTE_TIMEOUT_MS,
    sessionIdleLifetimeMs: policy.AUTH_SESSION_IDLE_TIMEOUT_MS,
  };
}

function buildPasskeyService(methods: AccountMethods): PasskeyService {
  return createPasskeyLinkingService({
    adapter: simpleWebAuthnRegistrationAdapter,
    clock: () => new Date(),
    policy: passkeyPolicy(),
    repository: createDrizzlePasskeyRepository(database(), methods.list),
  });
}

// The passkey sign-in service, made when a request first needs it.
export function createPasskeySignInResolver(): () => PasskeySignInService {
  let service: PasskeySignInService | undefined;
  return () => {
    service ??= createPasskeySignInService({
      adapter: simpleWebAuthnAuthenticationAdapter,
      clock: () => new Date(),
      policy: passkeyPolicy(),
      repository: createDrizzlePasskeySignInRepository(database()),
    });
    return service;
  };
}

// The wallet sign-in services: challenges and verification, removing a wallet, and ending a session. Built from the
// platform's wallet policy and the environment's session lifetimes, once, when the first request needs them.
export function createWalletServicesResolver(
  config: WalletAuthConfig,
  methods: AccountMethods,
  getPasskeyService: () => PasskeyService,
): () => WalletAuthServices {
  let services: WalletAuthServices | undefined;
  return () => {
    if (services) return services;
    const app = parseEnvironment(process.env);
    const environment = parseAuthSessionEnvironment(process.env);
    const clock = () => new Date();
    const lifetimes = {
      sessionAbsoluteLifetimeMs: environment.AUTH_SESSION_ABSOLUTE_TIMEOUT_MS,
      sessionIdleLifetimeMs: environment.AUTH_SESSION_IDLE_TIMEOUT_MS,
    };
    services = {
      auth: createWalletAuthService({
        clock,
        policy: {
          challengeLifetimeMs: config.challengeLifetimeMs,
          maximumVerificationAttempts: config.maximumVerificationAttempts,
          ...lifetimes,
        },
        repository: createDrizzleWalletAuthRepository(database()),
        verifier: strictBip322Verifier,
      }),
      methods: createWalletMethodsService({
        clock,
        policy: {
          recentAuthenticationWindowMs:
            environment.PASSKEY_RECENT_AUTH_WINDOW_MS,
          releaseHoldMs: config.releaseHoldMs,
          ...lifetimes,
        },
        repository: createDrizzleWalletMethodsRepository(
          database(),
          methods.list,
        ),
      }),
      origin: new URL(app.PUBLIC_BASE_URL).origin,
      passkeys: getPasskeyService(),
      recentAuthenticationWindowMs: environment.PASSKEY_RECENT_AUTH_WINDOW_MS,
      sessions: createSessionService({
        clock,
        idleLifetimeMs: environment.AUTH_SESSION_IDLE_TIMEOUT_MS,
        repository: createDrizzleSessionRepository(database()),
      }),
    };
    return services;
  };
}

// What the first-administrator setup needs of the platform's policy: which methods the administrator role requires, the version
// recorded with the grant, and how long a link lives. Supplied by the composition root, never read here.
export interface SetupRules {
  readonly lifetimeMs: number;
  readonly policyVersion: string;
  readonly requiredMethods: RoleRequirements;
}

// The setup-link service, made when a request first needs it.
export function createSetupLinkResolver(
  methods: AccountMethods,
  rules: SetupRules,
): () => SetupLinkService {
  let service: SetupLinkService | undefined;
  return () => {
    service ??= createSetupLinkService({
      clock: () => new Date(),
      policy: {
        lifetimeMs: rules.lifetimeMs,
        policyVersion: rules.policyVersion,
      },
      randomBytes: (length) => randomBytes(length),
      repository: createDrizzleSetupLinks(database(), {
        heldKinds: createHeldMethodKinds(methods),
        requiredMethods: rules.requiredMethods,
      }),
    });
    return service;
  };
}

// What signing in by email needs of the platform's configuration: how mail is sent and the code policy. Supplied by the composition
// root, never read here; `null` means the deployment has no mail, and the email routes answer that they are not available.
export interface EmailSignInRules {
  readonly mail: MailSettings;
  readonly policy: ContactCodePolicy;
}

// The email services, made when a request first needs them: the one-time-code service (signing in) and the link service (adding and
// removing an address on a signed-in account), over one channel and one sender. With no mail there is no channel at all, so asking for a
// code is refused as unsupported and nothing is stored.
export function createEmailResolvers(
  rules: EmailSignInRules | null,
  methods: AccountMethods,
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

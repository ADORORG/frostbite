import {
  createDrizzlePasskeyRepository,
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

function buildPasskeyService(methods: AccountMethods): PasskeyService {
  const app = parseEnvironment(process.env);
  const policy = parseAuthSessionEnvironment(process.env);
  const origin = new URL(app.PUBLIC_BASE_URL);
  return createPasskeyLinkingService({
    adapter: simpleWebAuthnRegistrationAdapter,
    clock: () => new Date(),
    policy: {
      challengeLifetimeMs: policy.PASSKEY_CHALLENGE_TIMEOUT_MS,
      expectedOrigin: origin.origin,
      recentAuthenticationWindowMs: policy.PASSKEY_RECENT_AUTH_WINDOW_MS,
      relyingPartyId: origin.hostname,
      relyingPartyName: app.NEXT_PUBLIC_APP_NAME,
      sessionAbsoluteLifetimeMs: policy.AUTH_SESSION_ABSOLUTE_TIMEOUT_MS,
      sessionIdleLifetimeMs: policy.AUTH_SESSION_IDLE_TIMEOUT_MS,
    },
    repository: createDrizzlePasskeyRepository(database(), methods.list),
  });
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

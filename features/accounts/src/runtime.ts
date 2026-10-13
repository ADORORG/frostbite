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
} from "@ador/auth";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import type { WalletAuthServices } from "./application/wallet-services.ts";
import type { WalletAuthConfig } from "./wallet-config.ts";
import {
  parseAuthSessionEnvironment,
  parseEnvironment,
} from "@repo/config/env";

let service: ReturnType<typeof createPasskeyLinkingService> | undefined;
let sharedDatabase: ReturnType<typeof createDatabaseClient> | undefined;

// One connection pool for everything this feature does, made when something first needs it.
function database() {
  sharedDatabase ??= createDatabaseClient(
    createDatabasePool(parseDatabaseEnvironment(process.env)),
  );
  return sharedDatabase;
}

export function getPasskeyLinkingService() {
  if (service) return service;
  const app = parseEnvironment(process.env);
  const policy = parseAuthSessionEnvironment(process.env);
  const origin = new URL(app.PUBLIC_BASE_URL);
  service = createPasskeyLinkingService({
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
    repository: createDrizzlePasskeyRepository(database()),
  });
  return service;
}

// The wallet sign-in services: challenges and verification, removing a wallet, and ending a session. Built from the
// platform's wallet policy and the environment's session lifetimes, once, when the first request needs them.
export function createWalletServicesResolver(
  config: WalletAuthConfig,
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
        repository: createDrizzleWalletMethodsRepository(database()),
      }),
      origin: new URL(app.PUBLIC_BASE_URL).origin,
      passkeys: getPasskeyLinkingService(),
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

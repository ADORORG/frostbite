export {
  BIP322_SIGNATURE_SCHEME,
  WALLET_CHALLENGE_SCHEMA_VERSION,
  walletAuthActions,
  type IssuedWalletChallenge,
  type WalletAuthenticationFailure,
  type WalletAuthenticationResult,
  type WalletAuthAction,
  type WalletChallengeMessage,
  type WalletSignatureVerifier,
  type WalletAuthPolicy,
  type IssueWalletChallengeInput,
  type VerifyWalletChallengeInput,
} from "./domain/contracts.ts";
export { serializeWalletChallenge } from "./domain/serialize-challenge.ts";
export { createWalletAuthService } from "./application/service.ts";
export { createDrizzleWalletAuthRepository } from "./adapters/drizzle-wallet-auth-repository.ts";
export { createDrizzleSessionRepository } from "./adapters/drizzle-session-repository.ts";
export { createSessionService } from "./application/session-service.ts";
export type {
  ActiveSession,
  SessionRepository,
} from "./application/session-repository.ts";
export { createPasskeyLinkingService } from "./passkeys/service.ts";
export { createPasskeySignInService } from "./passkeys/sign-in-service.ts";
export type {
  PasskeySignInPolicy,
  PasskeySignInService,
} from "./passkeys/sign-in-service.ts";
export { createDrizzlePasskeySignInRepository } from "./passkeys/drizzle-sign-in-repository.ts";
export { simpleWebAuthnAuthenticationAdapter } from "./passkeys/simplewebauthn-authentication.ts";
export type {
  PasskeyAuthenticationAdapter,
  PasskeyAuthenticationOptions,
  PasskeyAuthenticationPayload,
  PasskeySignInFailure,
} from "./passkeys/sign-in-contracts.ts";
export { createDrizzlePasskeyRepository } from "./passkeys/drizzle-repository.ts";
export { simpleWebAuthnRegistrationAdapter } from "./passkeys/simplewebauthn-adapter.ts";
export type {
  AuthenticatorTransport,
  PasskeyLinkFailure,
  PasskeyPolicy,
  PasskeyRegistrationAdapter,
  PasskeyRegistrationPayload,
  VerifiedPasskeyCredential,
} from "./passkeys/contracts.ts";
export {
  passkeyRegistrationOptionsSchema,
  passkeyRegistrationPayloadSchema,
} from "./passkeys/contracts.ts";
export {
  passkeyBeginResponseSchema,
  passkeyEmptyInputSchema,
  passkeyFinishInputSchema,
  passkeyListResponseSchema,
  passkeyMutationResponseSchema,
  passkeyRoutes,
  passkeySignedInResponseSchema,
  passkeySignInBeginResponseSchema,
  passkeySignInFinishInputSchema,
  passkeyUnlinkInputSchema,
  type PasskeyBeginResponse,
  type PasskeyFinishInput,
  type PasskeyListResponse,
  type PasskeyMutationResponse,
  type PasskeySignInBeginResponse,
  type PasskeySignInFinishInput,
  type PasskeyUnlinkInput,
} from "./passkeys/http.ts";
export {
  assuranceLevels,
  assuranceRank,
  methodKindSchema,
  type AssuranceLevel,
  type LinkedMethod,
  type ListMethods,
  type MethodAdapter,
  type MethodDescription,
  type MethodKind,
} from "./methods/contracts.ts";
export {
  createMethodRegistry,
  type MethodRegistry,
} from "./methods/registry.ts";
export {
  holdsMethod,
  meetsAssurance,
  removalOutcome,
  type RemovalOutcome,
} from "./methods/rule.ts";
export { walletMethod, walletMethodKind } from "./wallets/method.ts";
export { passkeyMethod, passkeyMethodKind } from "./passkeys/method.ts";
export { createWalletMethodsService } from "./wallets/service.ts";
export type {
  UnlinkWalletOutcome,
  WalletMethodsPolicy,
} from "./wallets/service.ts";
export { createDrizzleWalletMethodsRepository } from "./wallets/drizzle-repository.ts";
export type {
  LinkedWallet,
  UnlinkWalletResult,
  WalletMethodsRepository,
} from "./wallets/repository.ts";
export { strictBip322Verifier } from "./bitcoin/verifier.ts";
export {
  authMethodsResponseSchema,
  walletAuthRoutes,
  walletAuthUriPath,
  walletChallengeRequestSchema,
  walletChallengeResponseSchema,
  walletChangedResponseSchema,
  walletEmptyRequestSchema,
  walletNetworkSchema,
  walletSignedInResponseSchema,
  walletUnlinkRequestSchema,
  walletVerifyRequestSchema,
  type AuthMethodsResponse,
  type WalletChallengeRequest,
  type WalletChallengeResponse,
  type WalletUnlinkRequest,
  type WalletVerifyRequest,
} from "./wallets/http.ts";

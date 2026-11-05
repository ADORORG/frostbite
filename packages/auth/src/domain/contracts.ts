import type {
  BitcoinNetwork,
  ValidatedBitcoinAddress,
} from "@frostbite/chain/bitcoin";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import {
  walletAuthActions,
  type WalletAuthAction,
} from "@frostbite/shared/auth";

export { walletAuthActions, type WalletAuthAction };

export const WALLET_CHALLENGE_SCHEMA_VERSION = 1;
export const BIP322_SIGNATURE_SCHEME = "bip322-simple";

export interface WalletChallengeMessage {
  readonly action: WalletAuthAction;
  readonly address: ValidatedBitcoinAddress;
  readonly challengeId: UuidV7;
  readonly domain: string;
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly network: BitcoinNetwork;
  readonly nonce: string;
  readonly origin: string;
  readonly requestId: UuidV7;
  readonly schemaVersion: typeof WALLET_CHALLENGE_SCHEMA_VERSION;
  readonly signatureScheme: typeof BIP322_SIGNATURE_SCHEME;
  readonly uri: string;
}

export interface IssuedWalletChallenge {
  readonly challengeId: UuidV7;
  readonly expiresAt: Date;
  readonly message: string;
  readonly signatureScheme: typeof BIP322_SIGNATURE_SCHEME;
}

export type WalletAuthenticationFailure =
  | "challenge-expired"
  | "challenge-invalid"
  | "challenge-replayed"
  | "identity-conflict"
  | "signature-invalid"
  | "wallet-held"
  | "wallet-not-on-account"
  | "wallet-on-another-account";

export type WalletAuthenticationResult =
  | {
      readonly ok: true;
      readonly sessionToken: string;
      readonly userId: UuidV7;
    }
  | { readonly ok: false; readonly code: WalletAuthenticationFailure };

export interface WalletSignatureVerifier {
  verify(input: {
    readonly address: ValidatedBitcoinAddress;
    readonly message: string;
    readonly signature: string;
  }): boolean;
}

export interface WalletAuthPolicy {
  readonly challengeLifetimeMs: number;
  readonly maximumVerificationAttempts: number;
  readonly sessionAbsoluteLifetimeMs: number;
  readonly sessionIdleLifetimeMs: number;
}

export interface IssueWalletChallengeInput {
  readonly action: WalletAuthAction;
  readonly address: string;
  readonly expectedUserId?: UuidV7;
  readonly network: BitcoinNetwork;
  readonly origin: string;
  readonly requestId: UuidV7;
  readonly uri: string;
  readonly walletAdapter: string;
}

export interface VerifyWalletChallengeInput {
  readonly challengeId: UuidV7;
  // What the route verifying this challenge is for. A challenge made for another action, or for another account
  // than the one named here, is refused before anything changes: a link challenge cannot be used to sign in, and
  // one account's challenge cannot be completed from another's session.
  readonly expectedAction: WalletAuthAction;
  // The account the session verifying it belongs to; absent for sign-in, where there is no session yet.
  readonly expectedUserId?: UuidV7;
  readonly signature: string;
}

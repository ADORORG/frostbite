import type { UuidV7 } from "@ador/shared/identifiers";

import type { SessionMaterial } from "../application/repository.ts";
import type { StoredPasskeyCredential } from "./sign-in-contracts.ts";

export interface PasskeySignInChallengeRecord {
  readonly challengeHash: string;
  readonly challengeId: UuidV7;
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly origin: string;
  readonly relyingPartyId: string;
}

export type CompletePasskeySignInResult =
  | { readonly kind: "signed-in"; readonly userId: string }
  // The credential's counter changed since it was read: another sign-in used it meanwhile, or the credential is gone.
  | { readonly kind: "conflict" };

export interface PasskeySignInRepository {
  // Starts the session and records the new counter, only if the stored counter is still `expectedCounter`.
  completeSignIn(input: {
    readonly credentialId: string;
    readonly expectedCounter: number;
    readonly newCounter: number;
    readonly now: Date;
    readonly session: SessionMaterial;
  }): Promise<CompletePasskeySignInResult>;
  // Spends the challenge and gives it back, if it exists, is unspent and has not expired; otherwise null. Spending is one atomic
  // step, so a challenge answers one attempt however many arrive together.
  consumeChallenge(
    challengeId: UuidV7,
    now: Date,
  ): Promise<PasskeySignInChallengeRecord | null>;
  findCredential(credentialId: string): Promise<StoredPasskeyCredential | null>;
  issueChallenge(challenge: PasskeySignInChallengeRecord): Promise<void>;
}

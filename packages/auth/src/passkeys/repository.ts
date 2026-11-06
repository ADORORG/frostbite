import type { UuidV7 } from "@frostbite/shared/identifiers";
import type { CorrelationId } from "@frostbite/shared/http";

import type { SessionMaterial } from "../application/repository.ts";
import type { VerifiedPasskeyCredential } from "./contracts.ts";

export interface StoredPasskeyChallenge {
  readonly challengeHash: string;
  readonly challengeId: UuidV7;
  readonly consumedAt: Date | null;
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly origin: string;
  readonly relyingPartyId: string;
  readonly sessionId: UuidV7;
  readonly userId: UuidV7;
}

export type CompletePasskeyLinkResult =
  | { readonly kind: "linked" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid" }
  | { readonly kind: "replayed" };

export type UnlinkPasskeyResult =
  | { readonly kind: "unlinked" }
  | { readonly kind: "final-method" }
  | { readonly kind: "missing" };

export interface PasskeyRepository {
  completeLink(input: {
    readonly challenge: StoredPasskeyChallenge;
    readonly credential: VerifiedPasskeyCredential;
    readonly correlationId: CorrelationId;
    readonly minimumAuthenticatedAt: Date;
    readonly now: Date;
    readonly replacementSession: SessionMaterial;
  }): Promise<CompletePasskeyLinkResult>;
  findChallenge(challengeId: UuidV7): Promise<StoredPasskeyChallenge | null>;
  issueChallenge(challenge: StoredPasskeyChallenge): Promise<void>;
  listCredentialIds(userId: UuidV7): Promise<readonly string[]>;
  unlink(input: {
    readonly credentialId: string;
    readonly correlationId: CorrelationId;
    readonly minimumAuthenticatedAt: Date;
    readonly now: Date;
    readonly replacementSession: SessionMaterial;
    readonly sessionId: UuidV7;
    readonly userId: UuidV7;
  }): Promise<UnlinkPasskeyResult>;
}

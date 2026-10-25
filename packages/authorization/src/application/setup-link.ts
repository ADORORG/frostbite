import {
  encodeSetupToken,
  hashSetupToken,
  isSetupTokenShaped,
  setupTokenBytes,
} from "./setup-token.ts";

// The first administrator. Nobody can grant `admin` until one exists, so an operator with access to the deployment mints a single-use
// link, and whoever opens it while signed in with the methods an administrator needs becomes the first administrator. The link is
// printed to the operator's terminal, never emailed, and replaced by the next one minted.

export type MintResult =
  | { readonly kind: "minted" }
  // A working administrator already exists: setup is over, and roles are managed from the role screen.
  | { readonly kind: "admin-exists" };

export type RedeemResult =
  | { readonly kind: "granted" }
  // The same account used this link before (a retried request): nothing changes.
  | { readonly kind: "already-used-by-you" }
  // Unknown, expired, replaced, spent by someone else, or setup is already done. One answer for all, so a guess learns nothing.
  | { readonly kind: "invalid-link" }
  // The account lacks a sign-in method the administrator role needs; the link stays unspent so the person can add it and retry.
  | { readonly kind: "needs-method"; readonly missing: readonly string[] };

export interface SetupLinkRepository {
  mint(input: {
    readonly expiresAt: Date;
    readonly now: Date;
    readonly tokenHash: string;
  }): Promise<MintResult>;
  redeem(input: {
    readonly correlationId: string;
    readonly now: Date;
    readonly policyVersion: string;
    readonly tokenHash: string;
    readonly userId: string;
  }): Promise<RedeemResult>;
}

export interface SetupLinkPolicy {
  readonly lifetimeMs: number;
  readonly policyVersion: string;
}

export type MintedLink =
  | {
      readonly expiresAt: Date;
      readonly kind: "minted";
      readonly token: string;
    }
  | { readonly kind: "admin-exists" };

export function createSetupLinkService(input: {
  readonly clock: () => Date;
  readonly policy: SetupLinkPolicy;
  readonly randomBytes: (length: number) => Uint8Array;
  readonly repository: SetupLinkRepository;
}) {
  return {
    async mint(): Promise<MintedLink> {
      const token = encodeSetupToken(input.randomBytes(setupTokenBytes));
      const now = input.clock();
      const expiresAt = new Date(now.getTime() + input.policy.lifetimeMs);
      const result = await input.repository.mint({
        expiresAt,
        now,
        tokenHash: hashSetupToken(token),
      });
      return result.kind === "minted"
        ? { expiresAt, kind: "minted", token }
        : result;
    },

    async redeem(request: {
      readonly correlationId: string;
      readonly token: string;
      readonly userId: string;
    }): Promise<RedeemResult> {
      if (!isSetupTokenShaped(request.token)) return { kind: "invalid-link" };
      return input.repository.redeem({
        correlationId: request.correlationId,
        now: input.clock(),
        policyVersion: input.policy.policyVersion,
        tokenHash: hashSetupToken(request.token),
        userId: request.userId,
      });
    },
  };
}

export type SetupLinkService = ReturnType<typeof createSetupLinkService>;

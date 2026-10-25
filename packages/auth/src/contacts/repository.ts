import type { SessionMaterial } from "../application/repository.ts";
import type { MethodKind } from "../methods/contracts.ts";

export type CodePurpose = "link" | "sign-in";

export interface IssueCodeInput {
  readonly codeHash: string;
  readonly destination: string;
  readonly expiresAt: Date;
  readonly id: string;
  readonly issuedAt: Date;
  readonly kind: MethodKind;
  // What the code opens: signing in, or linking the destination to the signed-in account `userId` (null for signing in).
  readonly purpose: CodePurpose;
  // The limits the issue is decided under, so two requests together cannot both slip under them.
  readonly limits: {
    readonly cooldownMs: number;
    readonly maximumPerWindow: number;
    readonly windowMs: number;
  };
  readonly salt: string;
  readonly userId: string | null;
}

export type IssueCodeResult =
  | { readonly kind: "issued" }
  // Too soon after the last one, or too many in the window; `retryAfterMs` is when the next may be asked for.
  | {
      readonly kind: "cooldown" | "limit";
      readonly retryAfterMs: number;
    };

export interface HeldCode {
  readonly codeHash: string;
  readonly id: string;
  readonly salt: string;
}

export type CompleteCodeSignInResult =
  | { readonly kind: "signed-in"; readonly userId: string }
  // The code was used, replaced or expired between the check and the sign-in.
  | { readonly kind: "conflict" };

export interface ContactCodeRepository {
  // Finds the account that holds the destination (or makes one), spends the code and starts the session, in one transaction. Of any
  // number of attempts with the same code, exactly one signs in.
  completeSignIn(input: {
    readonly accountName: string;
    readonly codeId: string;
    readonly destination: string;
    readonly kind: MethodKind;
    readonly now: Date;
    readonly session: SessionMaterial;
  }): Promise<CompleteCodeSignInResult>;
  // Forgets a code that was issued but could not be delivered, so a failed send neither counts against the person nor leaves a code
  // nobody was sent.
  discard(id: string): Promise<void>;
  // Records one try at the newest live code of the destination and gives it back to be checked, or null when there is none (none sent,
  // used, replaced, expired, or all its tries spent). The try is counted before the code is compared, whatever the comparison says.
  takeAttempt(input: {
    readonly destination: string;
    readonly kind: MethodKind;
    readonly maximumAttempts: number;
    readonly now: Date;
    // Only a code sent for this can be tried: null for signing in, or the account a link code was sent to. (A code with an account is a
    // link code; the table checks that.)
    readonly userId: string | null;
  }): Promise<HeldCode | null>;
  // Records a new code for the destination and replaces the older live ones, unless the limits say not yet.
  issue(input: IssueCodeInput): Promise<IssueCodeResult>;
}

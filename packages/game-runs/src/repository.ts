export type RunState = "expired" | "issued" | "submitted";

// A run as stored: who it was issued to, for which game, under which verifier, and with which seed.
export interface StoredRun {
  readonly expiresAt: Date;
  readonly gameId: string;
  readonly id: string;
  readonly issuedAt: Date;
  readonly seed: number;
  readonly state: RunState;
  readonly userId: string;
  // The digest of the game's replay verifier when the run was issued.
  readonly verifierDigest: string;
}

export type NewRun = Omit<StoredRun, "state">;

// How a run ended: whether the replay verified it, why not if it did not, what it earned, and the record that was sent
// (canonical text, kept so the verdict can be audited, or null when it was not a record or was too large to keep).
export interface RunVerdict {
  readonly earned: readonly string[];
  readonly reason: string | null;
  readonly recordDigest: string | null;
  readonly recordText: string | null;
  // What the replay scored: only a verified run has one, and only when the game keeps a score and the run had ended.
  readonly score: number | null;
  readonly status: "rejected" | "verified";
}

// What the service decides about a run it has been handed under the row lock: refuse (and say whether the run is spent as
// expired), or settle it with a verdict.
export type SubmitDecision =
  | {
      readonly code: "already-submitted" | "expired" | "stale";
      readonly expire: boolean;
      readonly kind: "refuse";
    }
  | { readonly kind: "settle"; readonly verdict: RunVerdict };

export type SubmitResult =
  | {
      readonly ok: false;
      readonly code: "already-submitted" | "expired" | "not-found" | "stale";
    }
  | {
      readonly ok: true;
      readonly run: StoredRun;
      readonly verdict: RunVerdict;
    };

export type IssueResult =
  | { readonly ok: true }
  | { readonly code: "too-many-open-runs"; readonly ok: false };

// Where runs live. `issue` counts the player's open runs for the game and adds a run, as one step, so two starts cannot both
// pass a limit. `submit` finds the player's run for the game, hands it to `decide` **while holding its row**, and stores what
// `decide` returns, so a run is settled at most once however many submissions arrive together.
export interface GameRunRepository {
  issue(run: NewRun, maxOpenRuns: number): Promise<IssueResult>;
  submit(
    key: {
      readonly gameId: string;
      readonly runId: string;
      readonly userId: string;
    },
    decide: (run: StoredRun) => SubmitDecision,
  ): Promise<SubmitResult>;
}

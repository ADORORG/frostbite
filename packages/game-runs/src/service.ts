import { createHash } from "node:crypto";

import { canonicalJson, runRecordSchema } from "@ador/game-sdk/run-record";
import type { VerificationResult } from "@ador/game-verification/verify";

import type { GameRunPolicy } from "./policy.ts";
import type {
  GameRunRepository,
  RunVerdict,
  StoredRun,
  SubmitDecision,
} from "./repository.ts";

// What the service knows about a game, and nothing game-specific: the digest of the verifier the platform has loaded for it,
// and which of its milestones the manifest declares replay-verifiable. A game with no loaded verifier has none.
export interface GameRunGame {
  readonly verifiable: ReadonlySet<string>;
  readonly verifierSha256: string;
}

export interface GameRunsDependencies {
  readonly clock: () => Date;
  game(gameId: string): GameRunGame | null;
  newId(): string;
  newSeed(): number;
  readonly policy: GameRunPolicy;
  readonly repository: GameRunRepository;
  // Replays a record with the game's verifier and says whether it holds. Given the record as the player sent it.
  verify(gameId: string, record: unknown): VerificationResult;
}

export type StartRunResult =
  | {
      readonly ok: true;
      readonly run: {
        readonly expiresAt: string;
        readonly runId: string;
        readonly seed: number;
      };
    }
  | { readonly code: "too-many-open-runs" | "unavailable"; readonly ok: false };

export type SubmitRunResult =
  | {
      readonly ok: true;
      readonly verdict: {
        readonly digest: string | null;
        readonly earned: readonly string[];
        readonly reason: string | null;
        readonly status: "rejected" | "verified";
      };
    }
  | {
      readonly code: "already-submitted" | "expired" | "not-found" | "stale";
      readonly ok: false;
    };

// The most canonical text of a record the platform keeps, in characters (the SDK's 64 KB ceiling).
const maxStoredRecordCharacters = 65_536;

const rejection = (
  reason: string,
  recordDigest: string | null,
  recordText: string | null,
): RunVerdict => ({
  earned: [],
  reason,
  recordDigest,
  recordText,
  status: "rejected",
});

export function createGameRunsService(dependencies: GameRunsDependencies) {
  const { clock, game, newId, newSeed, policy, repository, verify } =
    dependencies;

  // What a player's submission for a run comes to, given the game's loaded verifier: the seed must be the one issued, every
  // claim must be a milestone the manifest says can be replay-verified, and the replay must hold. Any submission that
  // reaches here settles the run, so a record that is garbage, or for another seed, spends its seed.
  function verdictFor(
    run: StoredRun,
    current: GameRunGame,
    raw: unknown,
  ): RunVerdict {
    const parsed = runRecordSchema.safeParse(raw);
    // Not a run record at all: there is nothing to replay or to keep, and the run is spent.
    if (!parsed.success) return rejection("malformed", null, null);
    const record = parsed.data;
    const text = canonicalJson(record);
    const digest = createHash("sha256").update(text).digest("hex");
    const kept = text.length <= maxStoredRecordCharacters ? text : null;
    if (record.seed !== run.seed)
      return rejection("seed-mismatch", digest, kept);
    if (record.claims.some((id) => !current.verifiable.has(id)))
      return rejection("claim-not-verifiable", digest, kept);
    const result = verify(run.gameId, record);
    if (result.status === "rejected")
      return rejection(result.reason, digest, kept);
    return {
      earned: result.earned.filter((id) => current.verifiable.has(id)),
      reason: null,
      recordDigest: result.digest,
      recordText: kept,
      status: "verified",
    };
  }

  return {
    // A signed-in player asks for a run of a game. The game must have a verifier the platform has loaded; the seed is the
    // platform's own.
    async start(userId: string, gameId: string): Promise<StartRunResult> {
      const current = game(gameId);
      if (current === null) return { code: "unavailable", ok: false };
      const issuedAt = clock();
      const run = {
        expiresAt: new Date(issuedAt.getTime() + policy.runLifetimeMs),
        gameId,
        id: newId(),
        issuedAt,
        seed: newSeed(),
        userId,
        verifierDigest: current.verifierSha256,
      };
      const issued = await repository.issue(run, policy.maxOpenRuns);
      return issued.ok
        ? {
            ok: true,
            run: {
              expiresAt: run.expiresAt.toISOString(),
              runId: run.id,
              seed: run.seed,
            },
          }
        : { code: issued.code, ok: false };
    },

    // A player sends the record of a run they were issued. It is settled once: whoever else asks afterwards is told it was.
    async submit(
      userId: string,
      gameId: string,
      runId: string,
      raw: unknown,
    ): Promise<SubmitRunResult> {
      const decide = (run: StoredRun): SubmitDecision => {
        if (run.state === "submitted")
          return { code: "already-submitted", expire: false, kind: "refuse" };
        if (run.state === "expired")
          return { code: "expired", expire: false, kind: "refuse" };
        if (clock() >= run.expiresAt)
          return { code: "expired", expire: true, kind: "refuse" };
        // The game's rules may have changed since the run was issued; a run is checked only against the rules it was
        // issued under, so a run whose rules are gone is spent.
        const current = game(gameId);
        if (current === null || current.verifierSha256 !== run.verifierDigest)
          return { code: "stale", expire: true, kind: "refuse" };
        return { kind: "settle", verdict: verdictFor(run, current, raw) };
      };
      const result = await repository.submit({ gameId, runId, userId }, decide);
      return result.ok
        ? {
            ok: true,
            verdict: {
              digest: result.verdict.recordDigest,
              earned: result.verdict.earned,
              reason: result.verdict.reason,
              status: result.verdict.status,
            },
          }
        : { code: result.code, ok: false };
    },
  };
}

export type GameRunsService = ReturnType<typeof createGameRunsService>;

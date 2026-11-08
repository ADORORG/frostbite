import { createHash } from "node:crypto";

import { canonicalJson, runRecordSchema } from "@frostbite/game-sdk/run-record";
import type { GameReplayVerifier } from "@frostbite/shared/games";
import { z } from "zod";

import {
  createVerifierRegistry,
  type RegisteredVerifier,
  type VerifierRegistry,
} from "./registry.ts";
import type { LoadedArtifact, VerifierRunner } from "./runner.ts";
import type { ReplayOutcome, Verifier } from "./verifier.ts";

// What the loader needs of a game: its id, and the replay verifier its manifest pins, if it publishes one.
// What a replay is failed with when the verifier answered, but not with an outcome: not valid JSON, or JSON that is not an outcome.
const noOutcomeWords = "The verifier did not answer with an outcome.";

export interface VerifiableGame {
  readonly id: string;
  readonly verification?: { readonly replay: GameReplayVerifier } | undefined;
}

export type VerifierProblemReason =
  | "bad-sample"
  | "digest-mismatch"
  | "identity-mismatch"
  | "load-failed"
  | "missing-artifact"
  | "no-sandbox";

// A game whose published verifier could not be used, and why. Such a game's milestones simply stay self-reported; the
// problem is returned (never swallowed) so the platform can log it and a test can pin it.
export interface VerifierProblem {
  readonly detail: string;
  readonly gameId: string;
  readonly reason: VerifierProblemReason;
}

export interface LoadVerifiersOptions {
  readonly firstParty: ReadonlySet<string>;
  readonly games: readonly VerifiableGame[];
  // Reads a game's built `verifier.js`, or null when it is not there.
  readArtifact(gameId: string): Promise<string | null>;
  readonly runners: {
    // For the platform's own games only.
    readonly firstParty: VerifierRunner;
    // For everyone else's; absent until a sandboxed runner exists, which keeps outside games self-reported.
    readonly sandboxed?: VerifierRunner;
  };
}

const outcomeSchema = z.union([
  z.strictObject({
    earned: z.array(z.string()),
    ok: z.literal(true),
    score: z.int().min(0).nullable(),
  }),
  z.strictObject({
    detail: z.string(),
    index: z.int().min(0).nullable(),
    ok: z.literal(false),
    reason: z.enum(["illegal-input", "invalid-config", "verifier-error"]),
  }),
]);

const failed = (detail: string): ReplayOutcome => ({
  detail,
  index: null,
  ok: false,
  reason: "verifier-error",
});

// A verifier from a loaded artifact: the record goes in as its canonical text and the answer comes back as text, checked
// against the outcome shape. A script that fails, runs too long, or answers something that is not an outcome is a failure of
// the verifier, never a verdict on the run.
function verifierOf(
  loaded: LoadedArtifact,
  meta: { id: string; version: number },
): Verifier {
  return {
    id: meta.id,
    replay(record) {
      let answer: string;
      try {
        answer = loaded.replay(canonicalJson(record));
      } catch {
        return failed("The verifier failed or took too long.");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(answer);
      } catch {
        return failed(noOutcomeWords);
      }
      const outcome = outcomeSchema.safeParse(parsed);
      return outcome.success ? outcome.data : failed(noOutcomeWords);
    },
    version: meta.version,
  };
}

const digestOf = (code: string) =>
  createHash("sha256").update(new TextEncoder().encode(code)).digest("hex");

// Builds the platform's registry from games' manifests: for each game that publishes a replay verifier, reads its built
// artifact, refuses it unless its digest is the one the manifest pins, loads it with the runner its owner allows, checks it
// is the rules the manifest names and that its sample is a well-formed run. Nothing about any game is in this code.
export async function loadGameVerifiers(
  options: LoadVerifiersOptions,
): Promise<{
  readonly problems: readonly VerifierProblem[];
  readonly registry: VerifierRegistry;
}> {
  const entries: RegisteredVerifier[] = [];
  const problems: VerifierProblem[] = [];
  for (const game of options.games) {
    const pinned = game.verification?.replay;
    if (pinned === undefined) continue;
    const problem = (reason: VerifierProblemReason, detail: string) =>
      problems.push({ detail, gameId: game.id, reason });
    const code = await options.readArtifact(game.id);
    if (code === null) {
      problem("missing-artifact", "The game's verifier.js is not there.");
      continue;
    }
    const digest = digestOf(code);
    if (digest !== pinned.sha256) {
      problem(
        "digest-mismatch",
        `The artifact's digest is ${digest}, not the ${pinned.sha256} the manifest pins.`,
      );
      continue;
    }
    const runner = options.firstParty.has(game.id)
      ? options.runners.firstParty
      : options.runners.sandboxed;
    if (runner === undefined) {
      problem(
        "no-sandbox",
        "Outside games' verifiers need a sandboxed runner, and there is none.",
      );
      continue;
    }
    let loaded: LoadedArtifact;
    try {
      loaded = runner.load(code);
    } catch (error) {
      problem(
        "load-failed",
        error instanceof Error ? error.message : "The script did not load.",
      );
      continue;
    }
    if (
      loaded.meta.id !== pinned.id ||
      loaded.meta.version !== pinned.version
    ) {
      problem(
        "identity-mismatch",
        `The artifact is ${loaded.meta.id} version ${String(loaded.meta.version)}, not the ${pinned.id} version ${String(pinned.version)} the manifest names.`,
      );
      continue;
    }
    let sample: unknown;
    try {
      sample = JSON.parse(loaded.sample());
    } catch {
      sample = null;
    }
    const checked = runRecordSchema.safeParse(sample);
    if (!checked.success || checked.data.gameId !== game.id) {
      problem("bad-sample", "The sample run is not a record for this game.");
      continue;
    }
    entries.push({
      gameId: game.id,
      sample: checked.data,
      verifier: verifierOf(loaded, loaded.meta),
    });
  }
  return { problems, registry: createVerifierRegistry(entries) };
}

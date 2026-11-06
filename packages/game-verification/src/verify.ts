import { createHash } from "node:crypto";

import { canonicalJson, runRecordSchema } from "@frostbite/game-sdk/run-record";

import {
  defaultVerificationPolicy,
  type VerificationPolicy,
} from "./policy.ts";
import type { VerifierRegistry } from "./registry.ts";

export type RejectionReason =
  | "claim-not-earned"
  | "illegal-input"
  | "invalid-config"
  | "malformed"
  | "too-large"
  | "too-many-inputs"
  | "unknown-verifier"
  | "verifier-error"
  | "version-mismatch";

export type VerificationResult =
  | {
      // Every milestone the replay earned; the ones the record claimed are all among them.
      readonly earned: readonly string[];
      // The record's identity: SHA-256 of its canonical text, so the same run is the same digest.
      readonly digest: string;
      readonly status: "verified";
    }
  | {
      readonly detail: string;
      readonly digest: string | null;
      readonly reason: RejectionReason;
      readonly status: "rejected";
    };

const rejected = (
  reason: RejectionReason,
  detail: string,
  digest: string | null = null,
): VerificationResult => ({ detail, digest, reason, status: "rejected" });

// Checks a run record the platform was handed: that it is well formed and within limits, that it names a verifier
// the platform holds for that game, that replaying its inputs is legal at every step, and that every milestone it
// claims is one the replay earned. `raw` is untrusted input and the function answers a verdict for any value; it
// never throws. The caller limits the size of the body before parsing it.
export function verifyRun(
  registry: VerifierRegistry,
  raw: unknown,
  policy: VerificationPolicy = defaultVerificationPolicy,
): VerificationResult {
  const parsed = runRecordSchema.safeParse(raw);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return rejected(
      "malformed",
      issue === undefined
        ? "The record is not valid."
        : `${issue.path.join(".") || "record"}: ${issue.message}`,
    );
  }
  const record = parsed.data;
  const text = canonicalJson(record);
  const digest = createHash("sha256").update(text).digest("hex");
  if (new TextEncoder().encode(text).length > policy.maxRecordBytes)
    return rejected("too-large", "The record is too large.", digest);
  if (record.inputs.length > policy.maxInputs)
    return rejected(
      "too-many-inputs",
      "The record has too many inputs.",
      digest,
    );
  const entry = registry.find(record.gameId);
  if (entry === undefined || entry.verifier.id !== record.verifier)
    return rejected(
      "unknown-verifier",
      "The platform has no such verifier for that game.",
      digest,
    );
  if (entry.verifier.version !== record.verifierVersion)
    return rejected(
      "version-mismatch",
      `The record was made under version ${String(record.verifierVersion)}; the platform replays version ${String(entry.verifier.version)}.`,
      digest,
    );
  const replayed = entry.verifier.replay(record);
  if (!replayed.ok) return rejected(replayed.reason, replayed.detail, digest);
  const missing = record.claims.find(
    (claim) => !replayed.earned.includes(claim),
  );
  if (missing !== undefined)
    return rejected(
      "claim-not-earned",
      `The run did not earn ${missing}.`,
      digest,
    );
  return { digest, earned: replayed.earned, status: "verified" };
}

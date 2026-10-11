import { newId } from "./fixtures.ts";
import type { SubmissionRepository } from "../../src/application/submission-repository.ts";

export interface Call {
  readonly input: object;
  readonly method: string;
}

// A repository that records what it was asked and answers "not found", so service tests see exactly
// what the service passed down without a database.
export function recordingSubmissions() {
  const calls: Call[] = [];
  const record = (method: string) => (input: object) => {
    calls.push({ input, method });
    return Promise.resolve({ kind: "not-found" } as const);
  };
  const repository: SubmissionRepository = {
    activity: (input) => {
      calls.push({ input, method: "activity" });
      return Promise.resolve({ items: [], next: null });
    },
    decide: record("decide"),
    listForOwner: (input) => {
      calls.push({ input, method: "listForOwner" });
      return Promise.resolve([]);
    },
    queue: (input) => {
      calls.push({ input, method: "queue" });
      return Promise.resolve([]);
    },
    readForReview: (id) => {
      calls.push({ input: { id }, method: "readForReview" });
      return Promise.resolve(null);
    },
    submit: record("submit"),
  };
  const ids = [newId(), newId(), newId()];
  const createId = () => {
    const next = ids.shift();
    if (next === undefined) throw new Error("ran out of ids");
    return next;
  };
  return { calls, createId, ids: [...ids], repository };
}

export function fingerprintOf(call: Call | undefined): string {
  const sent = call?.input;
  if (
    sent === undefined ||
    !("requestFingerprint" in sent) ||
    typeof sent.requestFingerprint !== "string"
  )
    throw new Error("no fingerprint was sent");
  return sent.requestFingerprint;
}

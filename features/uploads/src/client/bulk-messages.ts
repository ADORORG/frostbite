import type { BulkEntry, BulkSummary } from "./bulk-state.ts";
import { describeUploadState, type UploadMessage } from "./upload-messages.ts";

// The one short line beside each file in a batch. A long batch cannot carry the full sentences a single
// upload shows, so the common states are brief and the rest reuse the single-upload wording.
const waiting: UploadMessage = {
  text: "Waiting for its turn.",
  tone: "attention",
};

export function describeBulkEntry(entry: BulkEntry): UploadMessage {
  const { state } = entry;
  // Only a file that has not started is idle; the single-upload wording has nothing to say about it.
  const message = describeUploadState(state);
  if (message === null) return waiting;
  if (state.status === "finished" && state.outcome === "processed")
    return { text: "Ready.", tone: "ready" };
  if (state.status === "running")
    return {
      text:
        state.stage === "transferring"
          ? `Uploading, ${Math.round(state.progress * 100)}%.`
          : state.stage === "processing"
            ? "Checking the image…"
            : "Preparing…",
      tone: "attention",
    };
  return message;
}

// The line above the list: how far along the batch is, in words that stay true while it moves.
export function describeBulkSummary(summary: BulkSummary): string {
  const done = summary.ready + summary.refused + summary.needsAttention;
  const parts = [`${summary.ready} of ${summary.total} ready`];
  if (summary.working + summary.waiting > 0)
    parts.push(`${summary.working + summary.waiting} still to go`);
  if (summary.needsAttention > 0)
    parts.push(`${summary.needsAttention} can be retried`);
  if (summary.refused > 0) parts.push(`${summary.refused} not accepted`);
  return done === 0 && summary.total === 0
    ? "No files yet."
    : `${parts.join(", ")}.`;
}

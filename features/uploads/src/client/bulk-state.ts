import type { FileRejection } from "./file-checks.ts";
import {
  isUploadBusy,
  uploadReducer,
  type UploadEvent,
  type UploadState,
} from "./upload-state.ts";

// One file in a batch. A file that was refused on sight (wrong type, too large) is never started; the
// others wait in line until the batch has room for them.
export interface BulkEntry {
  readonly id: string;
  readonly name: string;
  // False while the file waits its turn. Set when its first attempt begins, and never unset.
  readonly started: boolean;
  readonly state: UploadState;
}

export interface BulkState {
  readonly entries: readonly BulkEntry[];
}

export const initialBulkState: BulkState = { entries: [] };

export type BulkEvent =
  | {
      readonly type: "added";
      readonly waiting: readonly {
        readonly id: string;
        readonly name: string;
      }[];
      readonly refused: readonly {
        readonly id: string;
        readonly name: string;
        readonly rejection: FileRejection;
      }[];
    }
  | { readonly type: "entry"; readonly id: string; readonly event: UploadEvent }
  // Files still waiting are taken out of the batch (the creator cancelled).
  | { readonly type: "dropped-waiting" }
  // A file to try again goes back in line, so a retry of many files respects the batch's slots too.
  | { readonly type: "requeued"; readonly id: string }
  // Everything that is not waiting or moving is cleared away.
  | { readonly type: "cleared" };

const waitingState: UploadState = { status: "idle" };

export function isWaiting(entry: BulkEntry): boolean {
  return !entry.started && entry.state.status === "idle";
}

// A file occupies one of the batch's upload slots from its first attempt until the server has taken the
// object (the asset exists). Processing afterwards does not hold a slot: the server limits unfinished
// uploads, not images being checked.
export function isSecuring(entry: BulkEntry): boolean {
  return (
    entry.state.status === "running" && entry.state.attempt.assetId === null
  );
}

export function bulkReducer(state: BulkState, action: BulkEvent): BulkState {
  switch (action.type) {
    case "added":
      return {
        entries: [
          ...state.entries,
          ...action.waiting.map(({ id, name }) => ({
            id,
            name,
            started: false,
            state: waitingState,
          })),
          ...action.refused.map(({ id, name, rejection }) => ({
            id,
            name,
            started: true,
            state: { rejection, status: "invalid-file" } as const,
          })),
        ],
      };
    case "entry":
      return {
        entries: state.entries.map((entry) =>
          entry.id === action.id
            ? {
                ...entry,
                started: entry.started || action.event.type === "started",
                state: uploadReducer(entry.state, action.event),
              }
            : entry,
        ),
      };
    case "dropped-waiting":
      return { entries: state.entries.filter((entry) => !isWaiting(entry)) };
    case "requeued":
      return {
        entries: state.entries.map((entry) =>
          entry.id === action.id && canRetry(entry.state)
            ? { ...entry, started: false, state: waitingState }
            : entry,
        ),
      };
    case "cleared":
      return {
        entries: state.entries.filter(
          (entry) => isWaiting(entry) || isUploadBusy(entry.state),
        ),
      };
  }
}

// What trying again can help: a failure the network or server may recover from, a cancel, or processing
// that was still running when the wait ended. A refused file needs a different file instead.
export function canRetry(state: UploadState): boolean {
  return (
    (state.status === "failed" && state.retryable) ||
    state.status === "cancelled" ||
    state.status === "still-processing"
  );
}

export interface BulkSummary {
  // Failed, cancelled, or still processing past the wait: the creator can retry these.
  readonly needsAttention: number;
  // Refused for a reason retrying will not fix: a bad file, or one the server rejected.
  readonly refused: number;
  readonly ready: number;
  readonly total: number;
  readonly waiting: number;
  // Being sent or checked right now.
  readonly working: number;
}

export function summarize(state: BulkState): BulkSummary {
  const count = {
    needsAttention: 0,
    ready: 0,
    refused: 0,
    waiting: 0,
    working: 0,
  };
  for (const entry of state.entries) {
    const { state: s } = entry;
    if (isWaiting(entry)) count.waiting += 1;
    else if (s.status === "running") count.working += 1;
    else if (s.status === "finished" && s.outcome === "processed")
      count.ready += 1;
    else if (s.status === "finished" || s.status === "invalid-file")
      count.refused += 1;
    else count.needsAttention += 1;
  }
  return { ...count, total: state.entries.length };
}

// Whether anything is still moving, so the page can say "uploading" and keep its controls honest.
export function isBulkBusy(state: BulkState): boolean {
  return state.entries.some(
    (entry) => isWaiting(entry) || isUploadBusy(entry.state),
  );
}

import { describe, expect, it } from "vitest";

import {
  describeBulkEntry,
  describeBulkSummary,
} from "../../src/client/bulk-messages.ts";
import {
  bulkReducer,
  canRetry,
  initialBulkState,
  isBulkBusy,
  isSecuring,
  summarize,
  type BulkState,
} from "../../src/client/bulk-state.ts";
import { createUploadAttempt } from "../../src/client/upload-runner.ts";
import type { UploadEvent } from "../../src/client/upload-state.ts";

const attempt = createUploadAttempt({
  file: { name: "a.png", size: 3 },
  idempotencyKey: "upload-attempt-0001",
  purpose: "collection-item-artwork",
});
const entry = (id: string, event: UploadEvent) =>
  ({ event, id, type: "entry" }) as const;

function fold(...actions: Parameters<typeof bulkReducer>[1][]): BulkState {
  return actions.reduce(bulkReducer, initialBulkState);
}
const added = (...ids: string[]) =>
  ({
    refused: [],
    type: "added",
    waiting: ids.map((id) => ({ id, name: `${id}.png` })),
  }) as const;

describe("bulk state", () => {
  it("holds files in line until they start, and files refused on sight apart from them", () => {
    const state = fold({
      refused: [{ id: "2", name: "x.gif", rejection: { kind: "empty" } }],
      type: "added",
      waiting: [{ id: "1", name: "a.png" }],
    });
    expect(summarize(state)).toMatchObject({
      refused: 1,
      total: 2,
      waiting: 1,
    });
    expect(isBulkBusy(state)).toBe(true);
    expect(isBulkBusy(fold({ ...added(), type: "added" }))).toBe(false);
  });

  it("holds a slot from the first attempt until the server has taken the object", () => {
    const running = fold(added("1"), entry("1", { attempt, type: "started" }));
    expect(running.entries[0]).toMatchObject({ started: true });
    expect(isSecuring(running.entries[0]!)).toBe(true);
    const taken = bulkReducer(
      running,
      entry("1", { assetId: "a", type: "completed" }),
    );
    expect(isSecuring(taken.entries[0]!)).toBe(false);
    expect(summarize(taken).working).toBe(1);
  });

  it("counts every outcome in exactly one place", () => {
    let state = fold(added("1", "2", "3", "4", "5"));
    const go = (id: string, ...events: UploadEvent[]) => {
      state = [
        entry(id, { attempt, type: "started" }),
        ...events.map((event) => entry(id, event)),
      ].reduce(bulkReducer, state);
    };
    go("1", { outcome: "processed", reason: null, type: "finished" });
    go("2", { outcome: "rejected", reason: "malformed", type: "finished" });
    go("3", {
      cause: { kind: "unexpected" },
      retryable: true,
      type: "failed",
    });
    go("4");
    expect(summarize(state)).toEqual({
      needsAttention: 1,
      ready: 1,
      refused: 1,
      total: 5,
      waiting: 1,
      working: 1,
    });
  });

  it("puts only a file that trying again can help back in line, and keeps the rest", () => {
    const failed = (retryable: boolean) =>
      [
        entry("1", { attempt, type: "started" }),
        entry("1", {
          cause: { kind: "unexpected" },
          retryable,
          type: "failed",
        }),
      ] as const;
    expect(
      fold(added("1"), ...failed(true), { id: "1", type: "requeued" })
        .entries[0],
    ).toMatchObject({ started: false, state: { status: "idle" } });
    expect(
      fold(added("1"), ...failed(false), { id: "1", type: "requeued" })
        .entries[0]?.state.status,
    ).toBe("failed");
    expect(canRetry({ status: "idle" })).toBe(false);
    expect(
      canRetry({
        attempt,
        outcome: "rejected",
        reason: null,
        status: "finished",
      }),
    ).toBe(false);
    expect(canRetry({ attempt, status: "cancelled" })).toBe(true);
    expect(canRetry({ attempt, status: "still-processing" })).toBe(true);
  });

  it("drops waiting files on cancel and everything idle on clear, never a moving file", () => {
    const moving = fold(
      added("1", "2"),
      entry("1", { attempt, type: "started" }),
    );
    expect(
      bulkReducer(moving, { type: "dropped-waiting" }).entries.map((e) => e.id),
    ).toEqual(["1"]);
    const settled = bulkReducer(
      moving,
      entry("1", { outcome: "processed", reason: null, type: "finished" }),
    );
    expect(
      bulkReducer(settled, { type: "cleared" }).entries.map((e) => e.id),
    ).toEqual(["2"]);
    expect(bulkReducer(moving, { type: "cleared" }).entries).toHaveLength(2);
  });

  it("ignores events for a file that is not in the list", () => {
    const state = fold(added("1"));
    expect(
      bulkReducer(state, entry("9", { attempt, type: "started" })),
    ).toEqual(state);
  });
});

describe("bulk messages", () => {
  const running = (
    stage: "transferring" | "processing" | "requesting",
    progress = 0.4,
  ) =>
    fold(
      added("1"),
      entry("1", { attempt, type: "started" }),
      entry("1", { stage, type: "stage-entered" }),
      entry("1", { fraction: progress, type: "progress" }),
    ).entries[0]!;

  it("describes each state in a few words", () => {
    expect(describeBulkEntry(fold(added("1")).entries[0]!).text).toBe(
      "Waiting for its turn.",
    );
    expect(describeBulkEntry(running("transferring")).text).toBe(
      "Uploading, 40%.",
    );
    expect(describeBulkEntry(running("processing")).text).toBe(
      "Checking the image…",
    );
    expect(describeBulkEntry(running("requesting")).text).toBe("Preparing…");
    const ready = fold(
      added("1"),
      entry("1", { attempt, type: "started" }),
      entry("1", { outcome: "processed", reason: null, type: "finished" }),
    ).entries[0]!;
    expect(describeBulkEntry(ready)).toEqual({ text: "Ready.", tone: "ready" });
    const refused = fold(
      added("1"),
      entry("1", { attempt, type: "started" }),
      entry("1", {
        outcome: "rejected",
        reason: "malformed",
        type: "finished",
      }),
    ).entries[0]!;
    expect(describeBulkEntry(refused).tone).toBe("unavailable");
  });

  it("summarises a batch without claiming more than is true", () => {
    expect(describeBulkSummary(summarize(initialBulkState))).toBe(
      "No files yet.",
    );
    expect(
      describeBulkSummary({
        needsAttention: 2,
        ready: 3,
        refused: 1,
        total: 9,
        waiting: 2,
        working: 1,
      }),
    ).toBe("3 of 9 ready, 3 still to go, 2 can be retried, 1 not accepted.");
  });
});

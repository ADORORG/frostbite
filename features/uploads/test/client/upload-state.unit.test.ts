import { describe, expect, it } from "vitest";

import {
  initialUploadState,
  isUploadBusy,
  uploadReducer,
  type UploadAttempt,
  type UploadEvent,
  type UploadState,
} from "../../src/client/upload-state.ts";

const attempt: UploadAttempt = {
  assetId: null,
  file: { name: "art.png", size: 10 },
  idempotencyKey: "upload-attempt-0001",
  purpose: "collection-artwork",
  transferred: false,
};
const reduce = (
  events: readonly UploadEvent[],
  from: UploadState = initialUploadState,
) => events.reduce(uploadReducer, from);
const running = reduce([{ attempt, type: "started" }]);

describe("upload state machine", () => {
  it("starts idle and becomes running with the attempt at the first stage", () => {
    expect(initialUploadState).toEqual({ status: "idle" });
    expect(running).toEqual({
      attempt,
      progress: 0,
      stage: "requesting",
      status: "running",
    });
    expect(isUploadBusy(running)).toBe(true);
    expect(isUploadBusy(initialUploadState)).toBe(false);
  });

  it("walks the happy path and records what is done on the attempt", () => {
    const done = reduce(
      [
        { stage: "transferring", type: "stage-entered" },
        { fraction: 0.5, type: "progress" },
        { type: "transferred" },
        { stage: "completing", type: "stage-entered" },
        { assetId: "asset-1", type: "completed" },
        { stage: "processing", type: "stage-entered" },
        { outcome: "processed", reason: null, type: "finished" },
      ],
      running,
    );
    expect(done).toEqual({
      attempt: { ...attempt, assetId: "asset-1", transferred: true },
      outcome: "processed",
      reason: null,
      status: "finished",
    });
  });

  it("clamps progress and shows it only while transferring", () => {
    const transferring = reduce(
      [{ stage: "transferring", type: "stage-entered" }],
      running,
    );
    expect(
      reduce([{ fraction: 5, type: "progress" }], transferring),
    ).toMatchObject({ progress: 1 });
    expect(
      reduce([{ fraction: -1, type: "progress" }], transferring),
    ).toMatchObject({ progress: 0 });
    expect(reduce([{ fraction: 0.4, type: "progress" }], running)).toBe(
      running,
    );
    expect(reduce([{ type: "transferred" }], transferring)).toMatchObject({
      progress: 1,
    });
    expect(
      reduce(
        [
          { stage: "transferring", type: "stage-entered" },
          { fraction: 0.7, type: "progress" },
          { stage: "transferring", type: "stage-entered" },
        ],
        running,
      ),
    ).toMatchObject({ progress: 0 });
  });

  it("keeps progress when moving to a later stage", () => {
    const state = reduce(
      [
        { stage: "transferring", type: "stage-entered" },
        { fraction: 0.8, type: "progress" },
        { stage: "completing", type: "stage-entered" },
      ],
      running,
    );
    expect(state).toMatchObject({ progress: 0.8, stage: "completing" });
  });

  it("records a failure at the stage it happened in, with retryability", () => {
    const failed = reduce(
      [
        { stage: "transferring", type: "stage-entered" },
        {
          cause: { failure: "network", kind: "transfer" },
          retryable: true,
          type: "failed",
        },
      ],
      running,
    );
    expect(failed).toEqual({
      attempt,
      cause: { failure: "network", kind: "transfer" },
      retryable: true,
      stage: "transferring",
      status: "failed",
    });
  });

  const transferredAttempt: UploadAttempt = { ...attempt, transferred: true };
  it.each<[string, UploadState]>([
    [
      "failed",
      {
        attempt: transferredAttempt,
        cause: { code: "network", kind: "api" },
        retryable: true,
        stage: "completing",
        status: "failed",
      },
    ],
    ["cancelled", { attempt: transferredAttempt, status: "cancelled" }],
    [
      "still-processing",
      { attempt: transferredAttempt, status: "still-processing" },
    ],
  ])(
    "retries from %s with the same attempt, back at the first stage",
    (_name, stopped) => {
      expect(uploadReducer(stopped, { type: "retry" })).toEqual({
        attempt: transferredAttempt,
        progress: 0,
        stage: "requesting",
        status: "running",
      });
    },
  );

  it("ignores events that do not apply, so late callbacks cannot revive a stopped attempt", () => {
    const cancelled = reduce([{ type: "cancelled" }], running);
    for (const event of [
      { fraction: 0.5, type: "progress" },
      { type: "transferred" },
      { assetId: "a", type: "completed" },
      { outcome: "processed", reason: null, type: "finished" },
      { stage: "processing", type: "stage-entered" },
      { type: "cancelled" },
      { type: "still-processing" },
      {
        cause: { code: "network", kind: "api" },
        retryable: true,
        type: "failed",
      },
    ] as const)
      expect(uploadReducer(cancelled, event)).toBe(cancelled);
    expect(uploadReducer(initialUploadState, { type: "retry" })).toBe(
      initialUploadState,
    );
    const finished = reduce(
      [{ outcome: "processed", reason: null, type: "finished" }],
      running,
    );
    expect(uploadReducer(finished, { type: "retry" })).toBe(finished);
  });

  it("does not let a new file or a reset interrupt a running upload", () => {
    expect(
      uploadReducer(running, {
        attempt: { ...attempt, purpose: "creator-avatar" },
        type: "started",
      }),
    ).toBe(running);
    expect(
      uploadReducer(running, {
        rejection: { kind: "empty" },
        type: "file-invalid",
      }),
    ).toBe(running);
    expect(uploadReducer(running, { type: "reset" })).toBe(running);
  });

  it("reports a local rejection, and resets back to idle from any resting state", () => {
    const invalid = uploadReducer(initialUploadState, {
      rejection: { kind: "empty" },
      type: "file-invalid",
    });
    expect(invalid).toEqual({
      rejection: { kind: "empty" },
      status: "invalid-file",
    });
    expect(uploadReducer(invalid, { type: "reset" })).toEqual(
      initialUploadState,
    );
    const finished = reduce(
      [{ outcome: "rejected", reason: "malformed", type: "finished" }],
      running,
    );
    expect(finished).toMatchObject({
      outcome: "rejected",
      reason: "malformed",
    });
    expect(uploadReducer(finished, { type: "reset" })).toEqual(
      initialUploadState,
    );
    expect(uploadReducer(finished, { attempt, type: "started" })).toMatchObject(
      { status: "running" },
    );
  });
});

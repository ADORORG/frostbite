import { assetRejectionReasons } from "@ador/shared/uploads";
import { describe, expect, it } from "vitest";

import type { ApiErrorCode } from "@ador/client-http";
import {
  availableUploadActions,
  describeUploadState,
  type UploadActions,
} from "../../src/client/upload-messages.ts";
import {
  uploadStages,
  type UploadAttempt,
  type UploadState,
} from "../../src/client/upload-state.ts";

const attempt: UploadAttempt = {
  assetId: null,
  file: { name: "a.png", size: 3 },
  idempotencyKey: "upload-attempt-0001",
  purpose: "collection-artwork",
  transferred: false,
};
const apiCodes: ApiErrorCode[] = [
  "conflict",
  "forbidden",
  "idempotency_key_required",
  "internal_error",
  "invalid_request",
  "invalid-response",
  "method_not_allowed",
  "network",
  "not_found",
  "unauthorized",
];
const failed = (
  cause: Extract<UploadState, { status: "failed" }>["cause"],
  retryable = true,
): UploadState => ({
  attempt,
  cause,
  retryable,
  stage: "requesting",
  status: "failed",
});

describe("upload messages", () => {
  it("says nothing while idle", () => {
    expect(describeUploadState({ status: "idle" })).toBeNull();
  });

  it("describes every running stage as in progress", () => {
    const texts = uploadStages.map((stage) =>
      describeUploadState({ attempt, progress: 0, stage, status: "running" }),
    );
    expect(texts.every((message) => message?.tone === "attention")).toBe(true);
    expect(new Set(texts.map((message) => message?.text)).size).toBe(
      uploadStages.length,
    );
  });

  it("gives every API failure code its own non-empty, internals-free message", () => {
    const texts = apiCodes.map(
      (code) => describeUploadState(failed({ code, kind: "api" }))?.text ?? "",
    );
    expect(new Set(texts).size).toBe(apiCodes.length);
    for (const text of texts) {
      expect(text.length).toBeGreaterThan(15);
      expect(text).not.toMatch(/\b(401|403|409|500|http|json|zod)\b/i);
    }
    expect(
      describeUploadState(failed({ code: "network", kind: "api" }))?.tone,
    ).toBe("unavailable");
  });

  it("describes a defect in the page as such, not as a network or server problem", () => {
    const text =
      describeUploadState(failed({ kind: "unexpected" }, false))?.text ?? "";
    expect(text).toContain("Reload");
    expect(text).not.toMatch(/connection|server/i);
  });

  it("distinguishes transfer failures", () => {
    const network = describeUploadState(
      failed({ failure: "network", kind: "transfer" }),
    )?.text;
    const rejected = describeUploadState(
      failed({ failure: "rejected", kind: "transfer" }),
    )?.text;
    const aborted = describeUploadState(
      failed({ failure: "aborted", kind: "transfer" }),
    )?.text;
    expect(network).toContain("connection");
    expect(rejected).toContain("expired");
    expect(aborted).toBe(rejected);
  });

  it("reports a finished upload as the server decided, never as a guess", () => {
    const processed = describeUploadState({
      attempt,
      outcome: "processed",
      reason: null,
      status: "finished",
    });
    expect(processed).toMatchObject({ tone: "ready" });
    for (const reason of assetRejectionReasons) {
      const message = describeUploadState({
        attempt,
        outcome: "rejected",
        reason,
        status: "finished",
      });
      expect(message?.tone).toBe("unavailable");
      expect(message?.text.length).toBeGreaterThan(10);
    }
    expect(
      describeUploadState({
        attempt,
        outcome: "unprocessable",
        reason: null,
        status: "finished",
      }),
    ).toEqual({
      text: "This file could not be accepted.",
      tone: "unavailable",
    });
  });

  it("treats a long wait as neither success nor failure, and a cancel as a neutral note", () => {
    expect(
      describeUploadState({ attempt, status: "still-processing" }),
    ).toMatchObject({ tone: "attention" });
    expect(
      describeUploadState({ attempt, status: "cancelled" })?.text,
    ).toContain("Nothing was added");
  });

  it("describes a local rejection as unavailable-toned", () => {
    expect(
      describeUploadState({
        rejection: { kind: "empty" },
        status: "invalid-file",
      }),
    ).toMatchObject({
      tone: "unavailable",
    });
  });
});

describe("available upload actions", () => {
  const none = { cancel: false, reset: false, retry: false };
  it.each<[string, UploadState, UploadActions]>([
    ["idle", { status: "idle" }, none],
    [
      "running",
      {
        attempt,
        progress: 0,
        stage: "requesting",
        status: "running",
      },
      { ...none, cancel: true },
    ],
    [
      "a retryable failure",
      failed({ code: "network", kind: "api" }, true),
      { ...none, reset: true, retry: true },
    ],
    [
      "a permanent failure",
      failed({ code: "unauthorized", kind: "api" }, false),
      { ...none, reset: true },
    ],
    [
      "a cancel",
      { attempt, status: "cancelled" },
      { ...none, reset: true, retry: true },
    ],
    [
      "a long wait",
      { attempt, status: "still-processing" },
      { ...none, reset: true, retry: true },
    ],
    [
      "a finished upload",
      {
        attempt,
        outcome: "processed",
        reason: null,
        status: "finished",
      },
      { ...none, reset: true },
    ],
    [
      "a local rejection",
      { rejection: { kind: "empty" }, status: "invalid-file" },
      { ...none, reset: true },
    ],
  ])("offers the right controls for %s", (_name, state, expected) => {
    expect(availableUploadActions(state)).toEqual(expected);
  });
});

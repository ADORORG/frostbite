import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@frostbite/client-http";
import { TransferError } from "../../src/client/transfer.ts";
import { attempt, setup } from "../support/runner-harness.ts";

describe("upload runner failures", () => {
  it.each([
    [
      "a network failure",
      new ApiError("network", null, "x"),
      { code: "network", kind: "api", reason: null },
      true,
    ],
    [
      "a server fault",
      new ApiError("internal_error", 500, "x"),
      { code: "internal_error", kind: "api", reason: null },
      true,
    ],
    [
      "a conflict",
      new ApiError("conflict", 409, "x"),
      { code: "conflict", kind: "api", reason: null },
      false,
    ],
    [
      "no session",
      new ApiError("unauthorized", 401, "x"),
      { code: "unauthorized", kind: "api", reason: null },
      false,
    ],
  ] as const)(
    "reports %s from intent creation with the right retryability",
    async (_name, error, cause, retryable) => {
      const { events, go } = setup({
        api: { createIntent: vi.fn().mockRejectedValue(error) },
      });
      await go();
      expect(events).toEqual([
        { stage: "requesting", type: "stage-entered" },
        { cause, retryable, type: "failed" },
      ]);
    },
  );

  it("passes on the reason the server named, so the page can choose its words by it", async () => {
    const { events, go } = setup({
      api: {
        completeIntent: vi
          .fn()
          .mockRejectedValue(
            new ApiError("conflict", 409, "x", null, "file-not-arrived"),
          ),
      },
    });
    await go();
    expect(events.at(-1)).toMatchObject({
      cause: { code: "conflict", kind: "api", reason: "file-not-arrived" },
      type: "failed",
    });
  });

  it.each(["network", "rejected"] as const)(
    "reports a %s transfer failure as retryable",
    async (failure) => {
      const { events, go } = setup({
        transfer: {
          upload: vi
            .fn()
            .mockRejectedValue(
              new TransferError(failure, failure === "rejected" ? 403 : null),
            ),
        },
      });
      await go();
      expect(events.at(-1)).toEqual({
        cause: { failure, kind: "transfer" },
        retryable: true,
        type: "failed",
      });
    },
  );

  it("reports failures from completion and from polling", async () => {
    const completion = setup({
      api: {
        completeIntent: vi
          .fn()
          .mockRejectedValue(new ApiError("conflict", 409, "x")),
      },
    });
    await completion.go();
    expect(completion.events.at(-1)).toMatchObject({
      cause: { code: "conflict" },
      retryable: false,
      type: "failed",
    });
    const polling = setup({
      api: {
        listAssets: vi
          .fn()
          .mockRejectedValue(new ApiError("network", null, "x")),
      },
    });
    await polling.go();
    expect(polling.events.at(-1)).toMatchObject({
      cause: { code: "network" },
      retryable: true,
      type: "failed",
    });
  });

  it("reports a cancel, whatever the aborted call threw", async () => {
    const harness = setup({
      transfer: {
        upload: vi.fn(async ({ signal }) => {
          harness.controller.abort();
          signal.throwIfAborted();
        }),
      },
    });
    await harness.go();
    expect(harness.events.at(-1)).toEqual({ type: "cancelled" });
    expect(harness.events.some(({ type }) => type === "failed")).toBe(false);
  });

  it("does not swallow a defect that is not an expected failure", async () => {
    const { go } = setup({
      api: { createIntent: vi.fn().mockRejectedValue(new TypeError("bug")) },
    });
    await expect(go()).rejects.toThrow("bug");
  });

  it("creates a fresh attempt with nothing done", () => {
    expect(attempt).toEqual({
      assetId: null,
      file: { name: "a.png", size: 3 },
      idempotencyKey: "upload-attempt-0001",
      purpose: "collection-artwork",
      transferred: false,
    });
  });
});

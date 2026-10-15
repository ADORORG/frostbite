import { describe, expect, it, vi } from "vitest";

import {
  assetId,
  intentId,
  libraryAsset,
} from "../support/library-fixtures.ts";
import { attempt, intent, setup } from "../support/runner-harness.ts";

describe("upload runner", () => {
  it("runs every stage in order and reports the processed outcome", async () => {
    const { api, events, go, transfer } = setup();
    await go();
    expect(events).toEqual([
      { stage: "requesting", type: "stage-entered" },
      { stage: "transferring", type: "stage-entered" },
      { fraction: 0.5, type: "progress" },
      { type: "transferred" },
      { stage: "completing", type: "stage-entered" },
      { assetId, type: "completed" },
      { stage: "processing", type: "stage-entered" },
      { outcome: "processed", reason: null, type: "finished" },
    ]);
    expect(api.createIntent).toHaveBeenCalledWith(
      {
        byteLength: 3,
        contentType: "image/png",
        fileName: "a.png",
        purpose: "collection-artwork",
      },
      {
        idempotencyKey: attempt.idempotencyKey,
        signal: expect.any(AbortSignal),
      },
    );
    expect(transfer.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: intent.upload.headers,
        url: intent.upload.url,
      }),
    );
    expect(api.completeIntent).toHaveBeenCalledWith(
      { intentId },
      { signal: expect.any(AbortSignal) },
    );
  });

  it.each([
    [
      "rejected",
      libraryAsset({
        processingState: "rejected",
        rejectionReason: "malformed",
      }),
      "rejected",
      "malformed",
    ],
    [
      "unprocessable",
      libraryAsset({
        processingState: "unprocessable",
        rejectionReason: "decode-failed",
      }),
      "unprocessable",
      "decode-failed",
    ],
  ] as const)(
    "reports a %s asset with its reason",
    async (_name, asset, outcome, reason) => {
      const { events, go } = setup({
        api: {
          listAssets: vi.fn(async () => ({
            assets: [asset],
            nextCursor: null,
          })),
        },
      });
      await go();
      expect(events.at(-1)).toEqual({ outcome, reason, type: "finished" });
    },
  );

  it("reports still-processing when the wait budget runs out, which is not a failure", async () => {
    const { events, go } = setup({
      api: {
        listAssets: vi.fn(async () => ({
          assets: [libraryAsset()],
          nextCursor: null,
        })),
      },
    });
    await go();
    expect(events.at(-1)).toEqual({ type: "still-processing" });
    expect(events.some(({ type }) => type === "failed")).toBe(false);
  });

  it("skips the transfer when the attempt already transferred, but still asks for the intent", async () => {
    const { api, events, go, transfer } = setup();
    await go({ ...attempt, transferred: true });
    expect(transfer.upload).not.toHaveBeenCalled();
    expect(api.createIntent).toHaveBeenCalledTimes(1);
    expect(events.map(({ type }) => type)).not.toContain("transferred");
    expect(events.at(-1)).toMatchObject({ outcome: "processed" });
  });

  it("goes straight to processing when the asset already exists", async () => {
    const { api, events, go, transfer } = setup();
    await go({ ...attempt, assetId, transferred: true });
    expect(api.createIntent).not.toHaveBeenCalled();
    expect(transfer.upload).not.toHaveBeenCalled();
    expect(api.completeIntent).not.toHaveBeenCalled();
    expect(events[0]).toEqual({ stage: "processing", type: "stage-entered" });
  });

  it("leaves out a file name the server would refuse instead of failing the upload", async () => {
    const { api, go } = setup();
    await go({ ...attempt, file: { name: "folder/a.png", size: 3 } });
    expect(api.createIntent).toHaveBeenCalledWith(
      expect.not.objectContaining({ fileName: expect.anything() }),
      expect.anything(),
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import type { UploadState } from "../src/client/upload-state.ts";
import { UploadFeedback } from "../src/ui/components/upload-feedback.tsx";
import { button, click, mount, textOf } from "./support/dom.tsx";

const attempt = {
  assetId: null,
  file: { name: "a.png", size: 3 },
  idempotencyKey: "upload-attempt-0001",
  purpose: "collection-artwork" as const,
  transferred: false,
};

async function show(state: UploadState) {
  const handlers = { onCancel: vi.fn(), onReset: vi.fn(), onRetry: vi.fn() };
  const container = await mount(<UploadFeedback {...handlers} state={state} />);
  return { container, ...handlers };
}

describe("upload feedback", () => {
  it("renders nothing while idle", async () => {
    const { container } = await show({ status: "idle" });
    expect(container.innerHTML).toBe("");
  });

  it("shows a progress meter only while transferring, with a cancel control", async () => {
    const { container, onCancel } = await show({
      attempt,
      progress: 0.4,
      stage: "transferring",
      status: "running",
    });
    expect(textOf(container)).toContain("Uploading your image");
    expect(container.querySelector("progress")?.getAttribute("value")).toBe(
      "40",
    );
    await click(button(container, "Cancel upload"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(button(container, "Retry")).toBeNull();
  });

  it.each(["requesting", "completing", "processing"] as const)(
    "shows no meter while %s",
    async (stage) => {
      const { container } = await show({
        attempt,
        progress: 1,
        stage,
        status: "running",
      });
      expect(container.querySelector("progress")).toBeNull();
      expect(button(container, "Cancel upload")).not.toBeNull();
    },
  );

  it("offers a retry for a retryable failure, and only a new file otherwise", async () => {
    const cause = { code: "network" as const, kind: "api" as const };
    const retryable = await show({
      attempt,
      cause,
      retryable: true,
      stage: "requesting",
      status: "failed",
    });
    await click(button(retryable.container, "Retry"));
    expect(retryable.onRetry).toHaveBeenCalledOnce();
    await click(button(retryable.container, "Choose a different file"));
    expect(retryable.onReset).toHaveBeenCalledOnce();
    const final = await show({
      attempt,
      cause: { code: "unauthorized", kind: "api" },
      retryable: false,
      stage: "requesting",
      status: "failed",
    });
    expect(button(final.container, "Retry")).toBeNull();
    expect(textOf(final.container)).toContain("Sign in again");
  });

  it("says what the server decided for a finished upload and offers another", async () => {
    const processed = await show({
      attempt,
      outcome: "processed",
      reason: null,
      status: "finished",
    });
    expect(textOf(processed.container)).toContain("private draft");
    await click(button(processed.container, "Upload another"));
    expect(processed.onReset).toHaveBeenCalledOnce();
    const rejected = await show({
      attempt,
      outcome: "rejected",
      reason: "malformed",
      status: "finished",
    });
    expect(textOf(rejected.container)).toContain("not a valid image");
    expect(button(rejected.container, "Retry")).toBeNull();
  });

  it("offers a retry after a cancel and while processing is still running", async () => {
    for (const state of [
      { attempt, status: "cancelled" },
      { attempt, status: "still-processing" },
    ] as const) {
      const { container } = await show(state);
      expect(button(container, "Retry")).not.toBeNull();
    }
  });

  it("explains a rejected local file without a retry", async () => {
    const { container } = await show({
      rejection: { kind: "empty" },
      status: "invalid-file",
    });
    expect(textOf(container)).toContain("empty");
    expect(button(container, "Retry")).toBeNull();
    expect(button(container, "Choose a different file")).not.toBeNull();
  });

  it("offers the next step only for an image that was processed", async () => {
    const handlers = { onCancel: vi.fn(), onReset: vi.fn(), onRetry: vi.fn() };
    const next = <a href="/next">Use it</a>;
    const show = async (state: UploadState) =>
      mount(<UploadFeedback {...handlers} next={next} state={state} />);
    const processed = await show({
      attempt,
      outcome: "processed",
      reason: null,
      status: "finished",
    });
    expect(processed.querySelector('a[href="/next"]')).not.toBeNull();
    const refused = await show({
      attempt,
      outcome: "rejected",
      reason: "malformed",
      status: "finished",
    });
    expect(refused.querySelector('a[href="/next"]')).toBeNull();
    const running = await show({
      attempt,
      progress: 0.5,
      stage: "transferring",
      status: "running",
    });
    expect(running.querySelector('a[href="/next"]')).toBeNull();
  });
});

import type { FetchLike } from "@ador/client-http";
import { reviewRoutes } from "@ador/shared/collections";
import { idempotencyKeySchema } from "@ador/shared/http";
import { describe, expect, it, vi } from "vitest";

import { createReviewApi } from "../../src/client/review-api.ts";
import { createBrowserServices } from "../../src/client/services.ts";
import { detailOf, id, queueItem } from "../support/fixtures.ts";

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
const key = idempotencyKeySchema.parse("request-key-00000001");

describe("review API client", () => {
  it("asks for the queue by states and validates what comes back", async () => {
    const fetchImpl = vi.fn(async () => json({ items: [queueItem()] }));
    const result = await createReviewApi(fetchImpl).queue([
      "submitted",
      "under-review",
    ]);
    expect(result.items).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      reviewRoutes.queue.path,
      expect.objectContaining({
        body: JSON.stringify({ states: ["submitted", "under-review"] }),
        method: "POST",
      }),
    );
  });

  it("reads a submission by id with its previews", async () => {
    const detail = detailOf();
    const fetchImpl = vi.fn(async () => json(detail));
    const result = await createReviewApi(fetchImpl).read(detail.submission.id);
    expect(result.previews).toHaveLength(detail.previews.length);
    expect(fetchImpl).toHaveBeenCalledWith(
      reviewRoutes.read.path,
      expect.objectContaining({
        body: JSON.stringify({ submissionId: detail.submission.id }),
      }),
    );
  });

  it("sends a decision with its idempotency key", async () => {
    const detail = detailOf();
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ submission: detail.submission }),
    );
    await createReviewApi(fetchImpl).decide(
      {
        action: "approve",
        creatorFeedback: "",
        privateNotes: "",
        reasonCode: "reviewer-approved",
        submissionId: detail.submission.id,
      },
      { idempotencyKey: key },
    );
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: { "idempotency-key": key },
    });
  });

  it("refuses a response that does not match the contract", async () => {
    await expect(
      createReviewApi(async () => json({ items: [{ id: id() }] })).queue([
        "submitted",
      ]),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });
});

describe("browser services", () => {
  it("builds the real API and a fresh valid idempotency key each time, and accepts overrides", () => {
    const services = createBrowserServices();
    expect(services.createIdempotencyKey()).not.toBe(
      services.createIdempotencyKey(),
    );
    const replaced = createBrowserServices({ createIdempotencyKey: () => key });
    expect(replaced.createIdempotencyKey()).toBe(key);
  });
});

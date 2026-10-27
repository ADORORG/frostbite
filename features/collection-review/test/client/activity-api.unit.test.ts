import type { FetchLike } from "@ador/client-http";
import { reviewRoutes } from "@ador/shared/collections";
import { describe, expect, it, vi } from "vitest";

import { createReviewApi } from "../../src/client/review-api.ts";
import { activityItem, cursorAfter } from "../support/fixtures.ts";

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });

describe("activity API client", () => {
  it("asks for the first page with no cursor and validates the answer", async () => {
    const item = activityItem();
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ items: [item], nextCursor: cursorAfter(item) }),
    );
    const page = await createReviewApi(fetchImpl).activity(null);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe(cursorAfter(item));
    expect(fetchImpl).toHaveBeenCalledWith(
      reviewRoutes.activity.path,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends the cursor of the last event seen, and refuses an answer that breaks the contract", async () => {
    const item = activityItem();
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ items: [], nextCursor: null }),
    );
    await createReviewApi(fetchImpl).activity(cursorAfter(item));
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      `${reviewRoutes.activity.path}?cursor=${cursorAfter(item)}`,
    );
    await expect(
      createReviewApi(async () =>
        json({ items: [{ id: "x" }], nextCursor: null }),
      ).activity(null),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });
});

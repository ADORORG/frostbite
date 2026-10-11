import { ApiError } from "@ador/client-http";
import {
  resolveSubmissionTransition,
  type ReviewActivityItem,
  type ReviewDetailResponse,
  type ReviewQueueItem,
} from "@ador/shared/collections";
import { idempotencyKeySchema } from "@ador/shared/http";
import { vi } from "vitest";

import type { ReviewApi } from "../../src/client/review-api.ts";
import type { ReviewClientServices } from "../../src/client/services.ts";
import { cursorAfter, detailOf, event } from "./fixtures.ts";

// An in-memory review API with the server's rules that matter to the UI: a decision must be a legal
// move, an unknown submission is not found, and each call is a spy. Tests change `state` to stage a
// situation, and replace any method to stage a failure.
export function fakeReview(
  initial: ReviewDetailResponse = detailOf(),
  queue: readonly ReviewQueueItem[] = [],
  activity: readonly ReviewActivityItem[] = [],
  pageSize = 2,
) {
  const state = { activity: [...activity], detail: initial, queue: [...queue] };
  const api = {
    // Pages of the log in order, cut after the event the cursor names, as the real log does.
    activity: vi.fn<ReviewApi["activity"]>(async (cursor) => {
      const after =
        cursor === null
          ? 0
          : state.activity.findIndex((item) => cursorAfter(item) === cursor) +
            1;
      const items = state.activity.slice(after, after + pageSize);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          last !== undefined && after + pageSize < state.activity.length
            ? cursorAfter(last)
            : null,
      };
    }),
    decide: vi.fn<ReviewApi["decide"]>(async (decision) => {
      const current = state.detail.submission;
      const next = resolveSubmissionTransition(current.state, decision.action);
      if (next === null)
        throw new ApiError(
          "conflict",
          409,
          `This submission is ${current.state} and cannot take that action.`,
        );
      const submission = {
        ...current,
        events: [
          ...current.events,
          event(decision.action, {
            creatorFeedback: decision.creatorFeedback,
            nextState: next,
            previousState: current.state,
            privateNotes: decision.privateNotes,
            reasonCode: decision.reasonCode,
          }),
        ],
        state: next,
      };
      state.detail = { ...state.detail, submission };
      return { submission };
    }),
    queue: vi.fn<ReviewApi["queue"]>(async (states) => ({
      items: state.queue.filter((item) => states.includes(item.state)),
    })),
    read: vi.fn<ReviewApi["read"]>(async () => state.detail),
  } satisfies ReviewApi;
  let keys = 0;
  const services: ReviewClientServices = {
    api,
    createIdempotencyKey: () =>
      idempotencyKeySchema.parse(
        `request-key-${String((keys += 1)).padStart(8, "0")}`,
      ),
  };
  return { api, services, state };
}

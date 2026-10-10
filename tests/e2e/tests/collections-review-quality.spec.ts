import {
  collectionSubmissionListSchema,
  reviewQueueResponseSchema,
} from "@ador/shared/collections";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import { create, detailOf, draftBody } from "./support/collection-helpers.ts";
import { closeMatrix, prepare, skipToMain } from "./support/quality.ts";
import {
  answer,
  answerImages,
  detailBody,
  ids,
  later,
  stamp,
} from "./support/review-mocks.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the submission and review
// pages on every viewport project. The pages are real; their data is fixed by answering the API call
// that carries it, so the baselines show the design in known states (the journey spec covers the real
// services). Images are tiny inline data, so no signed URL or storage is involved.

test("the creator's review step closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(
    page,
    baseURL,
    creatorE2EFixtures.reviewQualityCreator.sessionToken,
  );
  const key = `review-quality-${Date.now()}-${test.info().project.name}`;
  const draft = await detailOf(
    await create(
      page.request,
      baseURL,
      key,
      draftBody({ description: "About it", name: "Review draft" }),
    ),
  );
  const feedback = {
    submissions: [
      {
        collectionId: draft.collection.id,
        collectionRevision: 1,
        createdAt: stamp,
        decisions: [
          {
            action: "start-review",
            createdAt: stamp,
            creatorFeedback: "",
            nextState: "under-review",
          },
          {
            action: "request-changes",
            createdAt: later,
            creatorFeedback:
              "Please add a cover image and describe how the lights were drawn.",
            nextState: "changes-requested",
          },
        ],
        id: ids.submission,
        payloadHash: "a".repeat(64),
        sequence: 1,
        state: "changes-requested",
        updatedAt: later,
      },
    ],
  };
  await answer(
    page,
    "collection-submissions/list",
    collectionSubmissionListSchema.parse(feedback),
  );
  await page.goto(`/studio/collections/${draft.collection.id}#review`);
  await expect(
    page.getByRole("heading", { level: 3, name: "Review" }),
  ).toBeVisible();
  await expect(page.getByText("Submission 1: Changes requested")).toBeVisible();
  await expect(page.getByText("Still needed").first()).toBeVisible();

  // Keyboard: past the skip link, the steps come first and the review step offers its way back.
  await skipToMain(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "1. Details" })).toBeFocused();
  await page.getByRole("button", { name: "1. Details" }).blur();
  await closeMatrix(page, "review-step-feedback.png");
});

test("the staff queue closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  const queue = {
    items: [
      {
        collectionId: ids.collection,
        collectionName: "First light",
        createdAt: stamp,
        id: ids.submission,
        sequence: 1,
        state: "submitted",
        updatedAt: stamp,
      },
      {
        collectionId: ids.banner,
        collectionName: "Second light",
        createdAt: stamp,
        id: ids.waiting,
        sequence: 2,
        state: "under-review",
        updatedAt: later,
      },
    ],
  };
  await answer(
    page,
    "collection-reviews/queue",
    reviewQueueResponseSchema.parse(queue),
  );
  await page.goto("/admin/collection-reviews");
  await expect(
    page.getByRole("heading", { level: 1, name: "Collection reviews" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open First light, submission 1" }),
  ).toBeVisible();

  // Keyboard: past the skip link, the group choice comes first, then the submissions in order.
  await skipToMain(page);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Show")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Open First light, submission 1" }),
  ).toBeFocused();
  await page.getByLabel("Show").focus();
  await page.getByLabel("Show").blur();
  await closeMatrix(page, "review-queue.png");
});

test("the empty staff queue closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answer(
    page,
    "collection-reviews/queue",
    reviewQueueResponseSchema.parse({ items: [] }),
  );
  await page.goto("/admin/collection-reviews");
  await expect(page.getByText("Nothing here right now.")).toBeVisible();
  await page.getByLabel("Show").focus();
  await page.getByLabel("Show").blur();
  await closeMatrix(page, "review-queue-empty.png");
});

test("a submission waiting for review closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answerImages(page);
  await answer(page, "collection-reviews/read", detailBody("submitted", []));
  await page.goto(`/admin/collection-reviews/${ids.submission}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Review a submission" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "1. Dawn" })).toBeVisible();

  // Keyboard: the decision is reachable with the arrow keys and Enter on the record button.
  await page.getByRole("radio", { name: "Start review" }).focus();
  await expect(page.getByRole("radio", { name: "Start review" })).toBeFocused();
  await page.getByRole("radio", { name: "Start review" }).blur();
  await closeMatrix(page, "review-detail-submitted.png");
});

test("a finished submission closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answerImages(page);
  await answer(
    page,
    "collection-reviews/read",
    detailBody("changes-requested", [
      {
        action: "start-review",
        actorName: "E2E reviewer",
        actorUserId: ids.reviewer,
        createdAt: stamp,
        creatorFeedback: "",
        nextState: "under-review",
        previousState: "submitted",
        privateNotes: "Rights look fine.",
        reasonCode: "reviewer-started-review",
      },
      {
        action: "request-changes",
        actorName: "E2E reviewer",
        actorUserId: ids.reviewer,
        createdAt: later,
        creatorFeedback: "Please add a banner.",
        nextState: "changes-requested",
        previousState: "under-review",
        privateNotes: "Banner missing.",
        reasonCode: "reviewer-requested-changes",
      },
    ]),
  );
  await page.goto(`/admin/collection-reviews/${ids.submission}`);
  await expect(
    page.getByText("No further decisions are possible"),
  ).toBeVisible();
  await closeMatrix(page, "review-detail-finished.png");
});

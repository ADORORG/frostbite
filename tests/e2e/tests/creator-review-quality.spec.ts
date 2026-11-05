import {
  creatorReviewQueueResponseSchema,
  creatorReviewReadResponseSchema,
} from "@frostbite/shared/creator-admission";
import { expect, test } from "@playwright/test";

import { creatorE2EFixtures } from "../src/creator-fixtures.ts";
import {
  closeMatrix,
  passBreadcrumb,
  prepare,
  skipToMain,
} from "./support/quality.ts";
import { answer, ids, later, stamp } from "./support/review-mocks.ts";

// Layout, keyboard, reduced-motion, accessibility, and visual coverage of the creator review pages on every
// viewport project. The pages are real; their data is fixed by answering the API call that carries it, so
// the baselines show the design in known states (creator-admission.spec.ts covers the real services).

const counts = { active: 3, all: 9, finished: 2, "needs-review": 4 };
const sent = {
  contentDeclarationAccepted: true,
  displayName: "Ada Maker",
  expectedLaunchSize: "Small beta cohort",
  expectedLaunchTiming: "After review",
  jurisdictionAcknowledged: true,
  portfolioLinks: ["https://example.test/portfolio"],
  projectSummary: "Pixel games drawn with lights.",
  provenanceDeclarationAccepted: true,
  rightsDeclarationAccepted: true,
};

test("the creator review queue closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answer(
    page,
    "creator-application/review-queue",
    creatorReviewQueueResponseSchema.parse({
      counts,
      items: [
        {
          applicationId: ids.submission,
          displayName: "Ada Maker",
          state: "submitted",
          submissionNumber: 1,
          submittedAt: stamp,
          updatedAt: stamp,
        },
        {
          applicationId: ids.waiting,
          displayName: "Bo Builder",
          state: "under-review",
          submissionNumber: 2,
          submittedAt: later,
          updatedAt: later,
        },
      ],
      nextCursor: "next",
    }),
  );
  await page.goto("/admin/creator-applications");
  await expect(
    page.getByRole("heading", { level: 1, name: "Creator reviews" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Ada Maker, submission 1" }),
  ).toBeVisible();

  // Keyboard: past the skip link and the breadcrumb, the four groups come first, then the order, then the applications.
  await skipToMain(page);
  await passBreadcrumb(page);
  for (const name of [
    /^All/u,
    /^Needs review/u,
    /^Approved or paused/u,
    /^Finished/u,
  ]) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Sort by")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Open Ada Maker, submission 1" }),
  ).toBeFocused();
  await page.getByLabel("Sort by").focus();
  await page.getByLabel("Sort by").blur();
  await closeMatrix(page, "creator-review-queue.png");
});

test("the empty creator review queue closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answer(
    page,
    "creator-application/review-queue",
    creatorReviewQueueResponseSchema.parse({
      counts: { active: 0, all: 0, finished: 0, "needs-review": 0 },
      items: [],
      nextCursor: null,
    }),
  );
  await page.goto("/admin/creator-applications");
  await expect(page.getByText("Nothing is waiting for review.")).toBeVisible();
  await page.getByLabel("Sort by").focus();
  await page.getByLabel("Sort by").blur();
  await closeMatrix(page, "creator-review-queue-empty.png");
});

test("an application under review closes the experience-quality matrix", async ({
  baseURL,
  page,
}) => {
  await prepare(page, baseURL, creatorE2EFixtures.reviewer.sessionToken);
  await answer(
    page,
    "creator-application/review-read",
    creatorReviewReadResponseSchema.parse({
      application: {
        applicationId: ids.submission,
        events: [
          {
            action: "submit",
            actorName: "Ada Maker",
            createdAt: stamp,
            creatorFeedback: "",
            nextState: "submitted",
            previousState: "draft",
            privateNotes: "",
            reasonCode: "applicant-submitted",
          },
          {
            action: "start-review",
            actorName: "E2E reviewer",
            createdAt: later,
            creatorFeedback: "Review has started.",
            nextState: "under-review",
            previousState: "submitted",
            privateNotes: "Portfolio link checks out.",
            reasonCode: "review-started",
          },
        ],
        snapshot: sent,
        state: "under-review",
        submissionNumber: 1,
        submittedAt: stamp,
      },
    }),
  );
  await page.goto(`/admin/creator-applications/${ids.submission}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Review an application" }),
  ).toBeVisible();
  await expect(page.getByText("Status: In review, submission 1")).toBeVisible();

  // Keyboard: past the skip link, the breadcrumb, then the decision, its fields, and the way back.
  await skipToMain(page);
  await passBreadcrumb(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("combobox", { name: "Decision" })).toBeFocused();
  await page.getByRole("combobox", { name: "Decision" }).blur();
  await closeMatrix(page, "creator-review-detail.png");
});

import {
  creatorAdmissionEvents,
  creatorApplications,
  type DatabaseClient,
} from "@frostbite/database";
import { creatorApplicationFixture } from "@frostbite/test-kit/creator-database";

import {
  creatorE2EFixtures,
  feedbackApplication,
} from "../src/creator-fixtures.ts";

// An applicant whose application a reviewer sent back, with the message the reviewer wrote for them and a
// private note that must never reach them.
export async function seedFeedbackApplication(database: DatabaseClient) {
  await database.insert(creatorApplications).values({
    applicantUserId: creatorE2EFixtures.applicantFeedback.userId,
    draft: creatorApplicationFixture,
    id: feedbackApplication.applicationId,
    state: "changes-requested",
  });
  await database.insert(creatorAdmissionEvents).values({
    action: "request-changes",
    actorUserId: creatorE2EFixtures.reviewer.userId,
    applicationId: feedbackApplication.applicationId,
    correlationId: "01994b10-0000-7000-8000-000000000066",
    createdAt: feedbackApplication.writtenAt,
    creatorFeedback: feedbackApplication.feedback,
    id: feedbackApplication.eventId,
    idempotencyKey: "e2e-seed-feedback-0001",
    nextState: "changes-requested",
    policyVersion: "creator-admission-beta-v1",
    previousState: "under-review",
    privateNotes: "Private: looks like a copy of another project.",
    reasonCode: "needs-more-evidence",
    requestFingerprint: "0".repeat(64),
  });
}

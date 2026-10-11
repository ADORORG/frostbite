import type { SubmissionState } from "@ador/shared/collections";

export interface QueueGroup {
  readonly id: "approved" | "finished" | "needs-review";
  readonly label: string;
  readonly states: readonly SubmissionState[];
}

const needsReview: QueueGroup = {
  id: "needs-review",
  label: "Needs review",
  states: ["submitted", "under-review"],
};

// The queue is read one group at a time, so a reviewer starts with what needs them.
export const queueGroups: readonly QueueGroup[] = [
  needsReview,
  {
    id: "approved",
    label: "Approved or paused",
    states: ["approved", "suspended"],
  },
  {
    id: "finished",
    label: "Finished",
    states: ["changes-requested", "rejected", "revoked"],
  },
];

export const defaultQueueGroup = needsReview;

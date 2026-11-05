import {
  submissionStateLabels,
  type SubmissionState,
} from "@frostbite/shared/collections";

export type SubmissionTone = "attention" | "ready" | "unavailable";

export interface SubmissionStateCopy {
  readonly label: string;
  readonly summary: string;
  readonly tone: SubmissionTone;
}

// What each state means to the creator, in plain words, under the label every surface shares.
// Approval is stated honestly: it does not publish or launch anything.
export const submissionStateCopy: Readonly<
  Record<SubmissionState, SubmissionStateCopy>
> = {
  approved: {
    label: submissionStateLabels.approved,
    summary:
      "A reviewer approved this version. Approval does not publish or launch it: that is a separate step.",
    tone: "ready",
  },
  "changes-requested": {
    label: submissionStateLabels["changes-requested"],
    summary: "A reviewer asked for changes. Make them, save, and submit again.",
    tone: "attention",
  },
  rejected: {
    label: submissionStateLabels.rejected,
    summary:
      "A reviewer did not approve this collection, and it cannot be submitted again.",
    tone: "unavailable",
  },
  revoked: {
    label: submissionStateLabels.revoked,
    summary:
      "An earlier approval was withdrawn, and this collection cannot be submitted again.",
    tone: "unavailable",
  },
  submitted: {
    label: submissionStateLabels.submitted,
    summary: "Waiting for a reviewer. Nothing more is needed from you.",
    tone: "attention",
  },
  suspended: {
    label: submissionStateLabels.suspended,
    summary:
      "The approval is paused while staff look into it. They will say what happens next.",
    tone: "unavailable",
  },
  "under-review": {
    label: submissionStateLabels["under-review"],
    summary: "A reviewer is looking at this version.",
    tone: "attention",
  },
};

import type { CreatorApplicationState } from "./contracts.ts";

// What a person is told about where their creator application stands, in one place so the studio and the
// application page never word the same state two ways. `canCreate` only keeps the studio from offering
// what would be refused; the server decides for real.
export interface CreatorStandingCopy {
  readonly body: string;
  readonly canCreate: boolean;
  readonly headline: string;
}

export const creatorStandingCopy: Readonly<
  Record<CreatorApplicationState, CreatorStandingCopy>
> = {
  approved: {
    body: "You can upload images and build collections.",
    canCreate: true,
    headline: "Approved creator",
  },
  "changes-requested": {
    body: "A reviewer asked for changes. Update your application and send it again.",
    canCreate: false,
    headline: "Changes requested",
  },
  draft: {
    body: "Your application is saved but not sent. Finish it and submit it to be reviewed.",
    canCreate: false,
    headline: "Application started",
  },
  rejected: {
    body: "Your application was not approved, so collections cannot be built from this account.",
    canCreate: false,
    headline: "Application not approved",
  },
  revoked: {
    body: "Creator access for this account has ended. Collections cannot be changed.",
    canCreate: false,
    headline: "Creator access ended",
  },
  submitted: {
    body: "Your application is waiting for a reviewer. You will see the result here.",
    canCreate: false,
    headline: "Application submitted",
  },
  suspended: {
    body: "Creator access is paused. Collections cannot be changed until it is reinstated.",
    canCreate: false,
    headline: "Creator access paused",
  },
  "under-review": {
    body: "A reviewer is looking at your application. You will see the result here.",
    canCreate: false,
    headline: "Application in review",
  },
};

export const neverAppliedCopy: CreatorStandingCopy = {
  body: "Apply to become a creator to upload images and build collections. You can save as you go.",
  canCreate: false,
  headline: "Not a creator yet",
};

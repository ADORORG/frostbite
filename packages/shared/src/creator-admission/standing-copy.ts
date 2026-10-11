import type { CreatorApplicationState } from "./contracts.ts";

// The colour a standing is shown in. These are the design system's tone names (`ArcadeTone`); the UI
// packages check at compile time that they match.
export type StandingTone = "cyan" | "mint" | "pink" | "red" | "yellow";

// What a person is told about where their creator application stands, in one place so the studio and the
// application page never word the same state two ways. `canCreate` only keeps the studio from offering
// what would be refused; the server decides for real.
export interface CreatorStandingCopy {
  readonly body: string;
  readonly canCreate: boolean;
  readonly headline: string;
  readonly tone: StandingTone;
}

export const creatorStandingCopy: Readonly<
  Record<CreatorApplicationState, CreatorStandingCopy>
> = {
  approved: {
    body: "You can upload images and build collections.",
    canCreate: true,
    headline: "Approved creator",
    tone: "mint",
  },
  "changes-requested": {
    body: "A reviewer asked for changes. Update your application and send it again.",
    canCreate: false,
    headline: "Changes requested",
    tone: "pink",
  },
  draft: {
    body: "Your application is saved but not sent. Finish it and submit it to be reviewed.",
    canCreate: false,
    headline: "Application started",
    tone: "yellow",
  },
  rejected: {
    body: "Your application was not approved, so collections cannot be built from this account.",
    canCreate: false,
    headline: "Application not approved",
    tone: "red",
  },
  revoked: {
    body: "Creator access for this account has ended. Collections cannot be changed.",
    canCreate: false,
    headline: "Creator access ended",
    tone: "red",
  },
  submitted: {
    body: "Your application is waiting for a reviewer. You will see the result here.",
    canCreate: false,
    headline: "Application submitted",
    tone: "cyan",
  },
  suspended: {
    body: "Creator access is paused. Collections cannot be changed until it is reinstated.",
    canCreate: false,
    headline: "Creator access paused",
    tone: "red",
  },
  "under-review": {
    body: "A reviewer is looking at your application. You will see the result here.",
    canCreate: false,
    headline: "Application in review",
    tone: "cyan",
  },
};

export const neverAppliedCopy: CreatorStandingCopy = {
  body: "Apply to become a creator to upload images and build collections. You can save as you go.",
  canCreate: false,
  headline: "Not a creator yet",
  tone: "yellow",
};

// The short answer to "can I build collections?" shown beside a standing, so every page words it the same.
export function standingBadgeLabel(
  copy: Pick<CreatorStandingCopy, "canCreate">,
): string {
  return copy.canCreate
    ? "Can build collections"
    : "Cannot build collections yet";
}

import {
  collectionNewPath,
  collectionWizardHref,
  standingOf,
  type CollectionSummary,
} from "@ador/shared/collections";
import type { CreatorApplicationState } from "@ador/shared/creator-admission";
import type { ArcadeTone } from "@repo/ui/arcade";

// What a person is told about their standing as a creator, and what they can do about it. The state
// comes from their creator application; null means they never applied. Pure, so every state's words,
// action, and permission are tested without a screen.

export const applicationHref = "/studio/creator-application";

export interface StandingCopy {
  readonly action: { readonly href: string; readonly label: string } | null;
  readonly body: string;
  // Whether this standing lets a person build collections. The server decides for real; this only
  // keeps the studio from offering what would be refused.
  readonly canCreate: boolean;
  readonly headline: string;
  readonly tone: ArcadeTone;
}

const apply = { href: applicationHref, label: "Apply to create" } as const;

const viewApplication = {
  href: applicationHref,
  label: "View your application",
} as const;

const states: Readonly<Record<CreatorApplicationState, StandingCopy>> = {
  approved: {
    action: null,
    body: "You can upload images and build collections.",
    canCreate: true,
    headline: "Approved creator",
    tone: "mint",
  },
  "changes-requested": {
    action: { href: applicationHref, label: "Update your application" },
    body: "A reviewer asked for changes. Update your application and send it again.",
    canCreate: false,
    headline: "Changes requested",
    tone: "pink",
  },
  draft: {
    action: { href: applicationHref, label: "Finish your application" },
    body: "Your application is saved but not sent. Finish it and submit it to be reviewed.",
    canCreate: false,
    headline: "Application started",
    tone: "yellow",
  },
  rejected: {
    action: viewApplication,
    body: "Your application was not approved, so collections cannot be built from this account.",
    canCreate: false,
    headline: "Application not approved",
    tone: "red",
  },
  revoked: {
    action: viewApplication,
    body: "Creator access for this account has ended. Collections cannot be changed.",
    canCreate: false,
    headline: "Creator access ended",
    tone: "red",
  },
  submitted: {
    action: viewApplication,
    body: "Your application is waiting for a reviewer. You will see the result here.",
    canCreate: false,
    headline: "Application submitted",
    tone: "cyan",
  },
  suspended: {
    action: viewApplication,
    body: "Creator access is paused. Collections cannot be changed until it is reinstated.",
    canCreate: false,
    headline: "Creator access paused",
    tone: "red",
  },
  "under-review": {
    action: viewApplication,
    body: "A reviewer is looking at your application. You will see the result here.",
    canCreate: false,
    headline: "Application in review",
    tone: "cyan",
  },
};

const neverApplied: StandingCopy = {
  action: apply,
  body: "Apply to become a creator to upload images and build collections. You can save as you go.",
  canCreate: false,
  headline: "Not a creator yet",
  tone: "yellow",
};

export function describeCreatorStanding(
  state: CreatorApplicationState | null,
): StandingCopy {
  return state === null ? neverApplied : states[state];
}

export interface NextStep {
  readonly href: string;
  readonly label: string;
  readonly text: string;
}

// The one thing worth doing next. Before approval it is the application; after, it is the collection
// that is waiting on the creator (changes asked for first, then a draft), or a new one. `collections`
// is null until the list has loaded, and then there is nothing honest to suggest.
export function nextStep(
  state: CreatorApplicationState | null,
  collections: readonly CollectionSummary[] | null,
): NextStep | null {
  const standing = describeCreatorStanding(state);
  if (!standing.canCreate)
    return standing.action === null
      ? null
      : {
          href: standing.action.href,
          label: standing.action.label,
          text: standing.body,
        };
  if (collections === null) return null;
  const waiting = (kind: "draft" | "needs-changes") =>
    collections.find(
      ({ submissionState }) => standingOf(submissionState) === kind,
    );
  const needsChanges = waiting("needs-changes");
  if (needsChanges !== undefined)
    return {
      href: collectionWizardHref(needsChanges.id),
      label: "Make changes",
      text: `A reviewer asked for changes to ${needsChanges.name}.`,
    };
  const draft = waiting("draft");
  if (draft !== undefined)
    return {
      href: collectionWizardHref(draft.id),
      label: "Continue editing",
      text: `${draft.name} is a draft you have not submitted.`,
    };
  return {
    href: collectionNewPath,
    label:
      collections.length === 0
        ? "Start your first collection"
        : "Start a collection",
    text:
      collections.length === 0
        ? "You have no collections yet."
        : "Nothing is waiting on you.",
  };
}

import {
  collectionNewPath,
  collectionWizardHref,
  standingOf,
  type CollectionSummary,
} from "@ador/shared/collections";
import {
  creatorStandingCopy,
  neverAppliedCopy,
  type CreatorApplicationState,
} from "@ador/shared/creator-admission";
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

// How each state is shown and where it leads; the words are shared with the application page.
const presentation: Readonly<
  Record<CreatorApplicationState, Pick<StandingCopy, "action" | "tone">>
> = {
  approved: { action: null, tone: "mint" },
  "changes-requested": {
    action: { href: applicationHref, label: "Update your application" },
    tone: "pink",
  },
  draft: {
    action: { href: applicationHref, label: "Finish your application" },
    tone: "yellow",
  },
  rejected: { action: viewApplication, tone: "red" },
  revoked: { action: viewApplication, tone: "red" },
  submitted: { action: viewApplication, tone: "cyan" },
  suspended: { action: viewApplication, tone: "red" },
  "under-review": { action: viewApplication, tone: "cyan" },
};

export function describeCreatorStanding(
  state: CreatorApplicationState | null,
): StandingCopy {
  return state === null
    ? { ...neverAppliedCopy, action: apply, tone: "yellow" }
    : { ...creatorStandingCopy[state], ...presentation[state] };
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

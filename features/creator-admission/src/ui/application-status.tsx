import {
  creatorStandingCopy,
  neverAppliedCopy,
  standingBadgeLabel,
  type CreatorApplicationResponse,
} from "@frostbite/shared/creator-admission";
import { collectionStudioPath } from "@frostbite/shared/collections";
import { ArcadeBadge, ArcadeButton } from "@repo/ui/arcade";

type Application = CreatorApplicationResponse["application"];

// Whether the person can still change what they wrote: before they send it, and after a reviewer asks
// for changes. Every other state is read-only, because what was sent is what a reviewer sees.
export function isEditable(application: Application | null): boolean {
  return (
    application === null ||
    application.state === "draft" ||
    application.state === "changes-requested"
  );
}

// Where the application stands, in the same words the studio uses.
export function StatusCard({
  application,
}: {
  readonly application: Application | null;
}) {
  const copy =
    application === null
      ? neverAppliedCopy
      : creatorStandingCopy[application.state];
  return (
    <article aria-label="Application status" className="arcade-card">
      <p className="arcade-eyebrow">Your application</p>
      <h3 className="arcade-card__title">{copy.headline}</h3>
      <ArcadeBadge tone={copy.tone}>{standingBadgeLabel(copy)}</ArcadeBadge>
      <p className="arcade-card__meta">{copy.body}</p>
      {copy.canCreate ? (
        <ArcadeButton href={collectionStudioPath} tone="mint">
          Go to your collections
        </ArcadeButton>
      ) : null}
    </article>
  );
}

// The states in which a reviewer's message still tells the person where they stand: asked for changes, not
// approved, paused, or ended. In the others (not yet sent, waiting, approved) it would be an old message.
const feedbackStates: readonly Application["state"][] = [
  "changes-requested",
  "rejected",
  "revoked",
  "suspended",
];

// The reviewer's message to show with this application, or null when there is none or it no longer applies.
export function feedbackToShow(
  application: Application | null,
): Application["feedback"] {
  return application !== null && feedbackStates.includes(application.state)
    ? application.feedback
    : null;
}

// What a reviewer wrote for the applicant. Shown as plain text, so nothing a reviewer types can act as markup.
export function ReviewerFeedback({
  feedback,
}: {
  readonly feedback: NonNullable<Application["feedback"]>;
}) {
  return (
    <article aria-label="Message from a reviewer" className="arcade-card">
      <p className="arcade-eyebrow">{`From a reviewer, ${feedback.createdAt.slice(0, 10)}`}</p>
      <p className="arcade-quote">{feedback.text}</p>
    </article>
  );
}

const declarations = [
  ["rightsDeclarationAccepted", "Holds the required rights and licences"],
  ["provenanceDeclarationAccepted", "Confirms the stated provenance"],
  ["contentDeclarationAccepted", "Accepts the content declaration"],
  ["jurisdictionAcknowledged", "Acknowledges jurisdiction requirements"],
] as const;

// What was sent, as plain text. Shown instead of the form once the application can no longer be edited.
export function SentApplication({
  draft,
  heading,
}: {
  readonly draft: NonNullable<Application>["draft"];
  // Whose words these are: "What you sent" to the applicant, "What the applicant sent" to a reviewer.
  readonly heading: string;
}) {
  const fields: readonly (readonly [string, string])[] = [
    ["Display name", draft.displayName],
    ["Portfolio", draft.portfolioLinks.join(", ") || "None given"],
    ["Project summary", draft.projectSummary],
    ["Expected launch size", draft.expectedLaunchSize],
    ["Expected launch timing", draft.expectedLaunchTiming],
  ];
  return (
    <section aria-label={heading} className="arcade-stack arcade-stack--tight">
      <h3>{heading}</h3>
      <dl className="arcade-details">
        {fields.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {declarations.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{draft[key] ? "Yes" : "No"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

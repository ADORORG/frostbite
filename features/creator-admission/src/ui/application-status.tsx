import {
  creatorStandingCopy,
  neverAppliedCopy,
  standingBadgeLabel,
  type CreatorApplicationResponse,
} from "@ador/shared/creator-admission";
import { collectionStudioPath } from "@ador/shared/collections";
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

const declarations = [
  ["rightsDeclarationAccepted", "Holds the required rights and licences"],
  ["provenanceDeclarationAccepted", "Confirms the stated provenance"],
  ["contentDeclarationAccepted", "Accepts the content declaration"],
  ["jurisdictionAcknowledged", "Acknowledges jurisdiction requirements"],
] as const;

// What was sent, as plain text. Shown instead of the form once the application can no longer be edited.
export function SentApplication({
  draft,
}: {
  readonly draft: NonNullable<Application>["draft"];
}) {
  const fields: readonly (readonly [string, string])[] = [
    ["Display name", draft.displayName],
    ["Portfolio", draft.portfolioLinks.join(", ") || "None given"],
    ["Project summary", draft.projectSummary],
    ["Expected launch size", draft.expectedLaunchSize],
    ["Expected launch timing", draft.expectedLaunchTiming],
  ];
  return (
    <section aria-label="What you sent" className="arcade-stack">
      <h3>What you sent</h3>
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

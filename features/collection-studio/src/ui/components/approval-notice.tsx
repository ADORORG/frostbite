import { ArcadeButton, ArcadeEmptyState } from "@repo/ui/arcade";

import type { StandingCopy } from "../../client/creator-standing.ts";

// Said instead of a form that would be refused: collections open once a creator is approved, and this
// names where the person stands and what to do about it.
export function ApprovalNotice({
  standing,
}: {
  readonly standing: StandingCopy;
}) {
  return (
    <ArcadeEmptyState
      action={
        standing.action === null ? undefined : (
          <ArcadeButton href={standing.action.href} tone={standing.tone}>
            {standing.action.label}
          </ArcadeButton>
        )
      }
      title="Collections open once you are an approved creator"
    >
      {`${standing.headline}. ${standing.body}`}
    </ArcadeEmptyState>
  );
}

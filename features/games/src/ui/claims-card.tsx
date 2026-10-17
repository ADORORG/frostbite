import type { GameClaim } from "@ador/shared/games";
import { ArcadeActionButton, ArcadeInfoCard } from "@repo/ui/arcade";

import { claimCopy, showsDelayed } from "../domain/claim-copy.ts";

// The player's claims for this game, with where each stands and a way back to the review of any that is not over.
export function ClaimsCard({
  claims,
  onReview,
  titles,
}: {
  readonly claims: readonly GameClaim[];
  readonly onReview: (claimId: string) => void;
  readonly titles: Readonly<Record<string, string>>;
}) {
  return (
    <ArcadeInfoCard title="Your claims">
      {claims.length === 0 ? (
        <p>You have not claimed anything from this game.</p>
      ) : (
        <ul aria-label="Claims of this game">
          {claims.map((claim) => (
            <li
              data-claim-state={claim.state}
              data-delayed={showsDelayed(claim) ? "true" : undefined}
              key={claim.id}
            >
              <strong>{titles[claim.milestoneId] ?? claim.milestoneId}</strong>{" "}
              — <span>{claimCopy(claim).label}</span>{" "}
              <ArcadeActionButton
                onClick={() => onReview(claim.id)}
                tone="cyan"
              >
                Details
              </ArcadeActionButton>
            </li>
          ))}
        </ul>
      )}
      <p>
        You pay the network fee to claim. A claim is complete only when the
        network&apos;s records show it.
      </p>
    </ArcadeInfoCard>
  );
}

// The dock section that holds the claims, with how many there are as its badge.
export const claimsDockSection = (
  claims: readonly GameClaim[],
  onReview: (claimId: string) => void,
  titles: Readonly<Record<string, string>>,
) => ({
  badge: claims.length === 0 ? null : String(claims.length),
  content: <ClaimsCard claims={claims} onReview={onReview} titles={titles} />,
  id: "claims",
  label: "Claims",
});

import { mintedCopy } from "../domain/minted-copy.ts";
import type { ShelfStats } from "../domain/shelf-view.ts";

// The collection in a few facts: how many milestones in how many games, since when, and the newest. Facts the records do not give (no
// mints yet) are left out rather than made up.
export function ShelfSummary({ stats }: { readonly stats: ShelfStats }) {
  return (
    <ul aria-label={mintedCopy.title} className="shelf-summary">
      <li>
        <strong>{mintedCopy.piecesCount(stats.pieces)}</strong>{" "}
        {mintedCopy.gamesCount(stats.games)}
      </li>
      {stats.firstDay === null ? null : (
        <li>{mintedCopy.firstMinted(stats.firstDay)}</li>
      )}
      {stats.latest === null ? null : (
        <li>{mintedCopy.latestMinted(stats.latest.title, stats.latest.day)}</li>
      )}
    </ul>
  );
}

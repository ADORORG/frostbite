import { mintedCopy } from "../domain/minted-copy.ts";
import type { ShelfStats } from "../domain/shelf-view.ts";

// The collection as a scoreboard: how many milestones, in how many games, and the newest. Facts the records do not give (no mints yet) are
// left out rather than made up.
export function ShelfSummary({ stats }: { readonly stats: ShelfStats }) {
  return (
    <ul aria-label={mintedCopy.title} className="shelf-summary">
      <li className="shelf-stat">
        <strong>{stats.pieces}</strong>
        <span>{mintedCopy.statMilestones(stats.pieces)}</span>
      </li>
      <li className="shelf-stat">
        <strong>{stats.games}</strong>
        <span>{mintedCopy.statGames(stats.games)}</span>
      </li>
      {stats.latest === null ? null : (
        <li className="shelf-stat shelf-stat--latest">
          <small>{mintedCopy.statLatest}</small>
          <strong>{stats.latest.title}</strong>
          <span>{stats.latest.day}</span>
        </li>
      )}
    </ul>
  );
}

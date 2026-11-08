import { GameCover } from "@frostbite/feature-games/game-cover";
import { ArcadeButton } from "@repo/ui/arcade";

import { profileCopy } from "../domain/copy.ts";
import type { ScoreTileModel } from "../domain/public-model.ts";

// One verified high score as the screen of a little cabinet: the game's picture behind the number, the number lit, when it was set, and one
// way to answer it. Only scores the platform's own replay reached are shown, so the badge says so.
export function ScoreTile({ best }: { readonly best: ScoreTileModel }) {
  const { scores } = profileCopy.page;
  return (
    <li className="score-tile">
      <div aria-hidden="true" className="score-tile__cover">
        <GameCover game={best.game} />
      </div>
      <p className="score-tile__game">{best.game.title}</p>
      <p className="score-tile__score">{best.score.toLocaleString("en-US")}</p>
      <div className="score-tile__foot">
        <span className="score-tile__verified">&#10003; {scores.verified}</span>
        <span className="score-tile__when">{scores.set(best.achievedAt)}</span>
      </div>
      <ArcadeButton
        ariaLabel={`${scores.beat}: ${best.game.title}`}
        href={best.playHref}
        tone="pink"
      >
        {scores.beat}
      </ArcadeButton>
    </li>
  );
}

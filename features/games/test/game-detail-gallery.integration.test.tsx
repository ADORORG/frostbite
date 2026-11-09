import { ScenesProvider } from "@frostbite/scenes/react";
import { WalletProvider } from "@frostbite/wallet/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import { galleryCopy } from "../src/domain/gallery-copy.ts";
import { leaderboardCopy } from "../src/domain/leaderboard-copy.ts";
import { GameDetail } from "../src/ui/game-detail.tsx";
import {
  chains,
  embeddedGame,
  replayedGame,
  rewardsGame,
  walletConfig,
} from "./support/template-game.ts";

const render = (source: Parameters<typeof createGameCatalog>[0][number]) => {
  const game = createGameCatalog([source], chains).list()[0];
  if (game === undefined) throw new Error("no game");
  return renderToStaticMarkup(
    <ScenesProvider>
      <WalletProvider network="signet">
        <GameDetail game={game} navigation={[]} wallet={walletConfig} />
      </WalletProvider>
    </ScenesProvider>,
  );
};

describe("a game's page", () => {
  it("has a Minted section in its dock when the game mints milestones, and none when it does not", () => {
    expect(render(rewardsGame)).toContain(galleryCopy.title);
    expect(render(embeddedGame)).not.toContain(`>${galleryCopy.title}<`);
  });

  it("has a Leaderboard section in its dock when the platform replays the game's runs, and none when it does not", () => {
    const tab = `>${leaderboardCopy.title}<`;
    expect(render(replayedGame)).toContain(tab);
    expect(render(rewardsGame)).not.toContain(tab);
    expect(render(embeddedGame)).not.toContain(tab);
  });
});

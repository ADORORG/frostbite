import { ScenesProvider } from "@frostbite/scenes/react";
import { WalletProvider } from "@frostbite/wallet/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import { galleryCopy } from "../src/domain/gallery-copy.ts";
import { GameDetail } from "../src/ui/game-detail.tsx";
import {
  chains,
  embeddedGame,
  rewardsGame,
  walletConfig,
} from "./support/template-game.ts";

const render = (source: typeof rewardsGame) => {
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
});

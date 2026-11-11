import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { shareCopy } from "../src/domain/share-copy.ts";
import type { SharedModel } from "../src/domain/shared-model.ts";
import {
  SharedBody,
  SharedNotFound,
  SharedPage,
} from "../src/ui/shared-page.tsx";

const game = {
  cover: { alt: "", image: "/cover.png" },
  id: "arcade",
  playHref: "/games/arcade",
  title: "Arcade",
};
const html = (model: SharedModel) =>
  renderToStaticMarkup(<SharedBody model={model} />);

describe("a shared milestone", () => {
  const milestone: SharedModel = {
    criteria: "Run 5,000 metres.",
    description: "You outran the cold.",
    game,
    kind: "milestone",
    mint: { day: "17 Oct 2026", picture: "/p.svg" },
    mintCount: 128,
    title: "Frost Walker",
    verification: "replay-verified",
  };

  it("shows the title big, the picture, how it is earned, how many have it and a way to play", () => {
    const out = html(milestone);
    expect(out).toContain("Frost Walker");
    expect(out).toContain('src="/p.svg"');
    expect(out).toContain(shareCopy.page.milestoneKicker);
    expect(out).toContain("Run 5,000 metres.");
    expect(out).toContain("You outran the cold.");
    expect(out).toContain("128");
    expect(out).toContain(shareCopy.page.mintCountLabel(128));
    expect(out).toContain(shareCopy.verification);
    expect(out).toContain(shareCopy.page.minted("17 Oct 2026"));
    expect(out).toContain('href="/games/arcade"');
    expect(out).toContain(shareCopy.play("Arcade"));
  });

  it("claims no mint and no count that it does not have, and never says verified for a reported one", () => {
    const out = html({
      ...milestone,
      mint: null,
      mintCount: null,
      verification: "self-reported",
    });
    expect(out).not.toContain(shareCopy.page.mintedBadge);
    expect(out).not.toContain("players have minted");
    expect(out).not.toContain(shareCopy.verification);
    expect(out.toLowerCase()).not.toContain("self-reported");
  });
});

describe("a shared score", () => {
  it("shows the score as a scoreboard, with its label and a challenge", () => {
    const out = html({
      game,
      kind: "score",
      score: "4,210",
      verification: "self-reported",
    });
    expect(out).toContain("4,210");
    expect(out).toContain(shareCopy.page.scoreKicker);
    expect(out).toContain(shareCopy.page.scoreCta.title);
    expect(out).not.toContain(shareCopy.verification);
    expect(out.toLowerCase()).not.toContain("self-reported");
  });
});

describe("a shared shelf", () => {
  const pieces = [0, 1].map((at) => ({
    claimId: `c${String(at)}`,
    day: "17 Oct 2026",
    game: "Arcade",
    picture: `/p${String(at)}.svg`,
    title: `Piece ${String(at)}`,
  }));

  it("shows each piece with its picture and day, counts what is beyond, and sends the reader to the games once", () => {
    const out = html({
      browseHref: "/games",
      games: 1,
      kind: "milestones",
      more: 4,
      pieces,
    });
    expect(out).toContain(shareCopy.page.shelfTitle(6, 1));
    expect(out).toContain("Piece 0");
    expect(out).toContain('src="/p1.svg"');
    expect(out).toContain(shareCopy.page.moreOnShelf(4));
    expect(out.split('href="/games"')).toHaveLength(2);
  });

  it("is an empty shelf without a grid", () => {
    const out = html({
      browseHref: "/games",
      games: 0,
      kind: "milestones",
      more: 0,
      pieces: [],
    });
    expect(out).not.toContain("shared-shelf");
  });
});

describe("the page around it", () => {
  it("wraps a shared page in the platform's frame, and a link that is not shared says no more than that", () => {
    expect(
      renderToStaticMarkup(
        <SharedPage
          model={{
            browseHref: "/games",
            games: 0,
            kind: "milestones",
            more: 0,
            pieces: [],
          }}
          navigation={[]}
        />,
      ),
    ).toContain(shareCopy.page.shelfCta.title);
    const lost = renderToStaticMarkup(<SharedNotFound navigation={[]} />);
    expect(lost).toContain(shareCopy.notFoundTitle);
    expect(lost).toContain(shareCopy.notFoundBody);
  });
});

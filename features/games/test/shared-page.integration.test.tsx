import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { shareCopy } from "../src/domain/share-copy.ts";
import { sharedView } from "../src/domain/shared-view.ts";
import { SharedNotFound, SharedPage } from "../src/ui/shared-page.tsx";
import { templateGame } from "./support/template-game.ts";

const markup = (thing: Parameters<typeof sharedView>[0]) => {
  const view = sharedView(thing, [templateGame]);
  if (view === null) throw new Error("The share has no view.");
  return renderToStaticMarkup(<SharedPage navigation={[]} view={view} />);
};

describe("the page a shared link opens", () => {
  it("shows a score with its label and a way to play the game", () => {
    const html = markup({
      gameId: "template-game",
      kind: "score",
      score: 4210,
      verification: "self-reported",
    });
    expect(html).toContain("4,210 in Template game");
    expect(html).toContain(shareCopy.verification["self-reported"]);
    expect(html).toContain('href="/games/template-game"');
    expect(html).toContain("Play Template game");
    expect(html).not.toContain(shareCopy.verification["replay-verified"]);
  });

  it("calls a milestone verified only when the account does", () => {
    const html = markup({
      gameId: "template-game",
      kind: "milestone",
      milestoneId: "first-level",
      verification: "replay-verified",
    });
    expect(html).toContain("First level");
    expect(html).toContain(shareCopy.verification["replay-verified"]);
  });

  it("the case shows no level and sends the reader to the games", () => {
    const html = markup({ kind: "milestones" });
    expect(html).toContain(shareCopy.collectionTitle);
    expect(html).toContain('href="/games"');
    for (const label of Object.values(shareCopy.verification))
      expect(html).not.toContain(label);
  });

  it("a link that is not shared says no more than that", () => {
    const html = renderToStaticMarkup(<SharedNotFound navigation={[]} />);
    expect(html).toContain(shareCopy.notFoundTitle);
    expect(html).toContain(shareCopy.notFoundBody);
  });
});

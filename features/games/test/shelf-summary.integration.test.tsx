// @vitest-environment jsdom

import { mount, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { mintedCopy } from "../src/domain/minted-copy.ts";
import { ShelfSummary } from "../src/ui/shelf-summary.tsx";

describe("the collection's scoreboard", () => {
  it("leaves out a newest milestone the records do not give, instead of making one up", async () => {
    const container = await mount(
      <ShelfSummary
        stats={{ firstDay: null, games: 0, latest: null, pieces: 0 }}
      />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(textOf(container)).toContain(`0${mintedCopy.statMilestones(0)}`);
    expect(textOf(container)).not.toContain(mintedCopy.statLatest);
  });

  it("says one milestone in one game in the singular, with the newest and its day", async () => {
    const container = await mount(
      <ShelfSummary
        stats={{
          firstDay: "1 Oct 2026",
          games: 1,
          latest: { day: "1 Oct 2026", title: "First level" },
          pieces: 1,
        }}
      />,
    );
    expect(textOf(container)).toBe(
      `1${mintedCopy.statMilestones(1)}1${mintedCopy.statGames(1)}${mintedCopy.statLatest}First level1 Oct 2026`,
    );
    expect(mintedCopy.statMilestones(1)).toBe("milestone");
    expect(mintedCopy.statGames(2)).toBe("games");
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });
});

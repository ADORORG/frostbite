// @vitest-environment jsdom

import { mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { mintedCopy } from "../src/domain/minted-copy.ts";
import { ShelfSummary } from "../src/ui/shelf-summary.tsx";

describe("the collection's facts", () => {
  it("leaves out a date or a newest milestone the records do not give, instead of making one up", async () => {
    const container = await mount(
      <ShelfSummary
        stats={{ firstDay: null, games: 0, latest: null, pieces: 0 }}
      />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(textOf(container)).toContain(mintedCopy.piecesCount(0));
    expect(textOf(container)).not.toContain("First minted");
    expect(textOf(container)).not.toContain("Latest");
  });

  it("says one milestone in one game in the singular", async () => {
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
    expect(textOf(container)).toContain("1 milestone in 1 game");
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });
});

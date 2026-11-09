// @vitest-environment jsdom

import { click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { LeaderboardApi } from "../src/client/leaderboard-api.ts";
import { leaderboardCopy } from "../src/domain/leaderboard-copy.ts";
import { Leaderboard } from "../src/ui/leaderboard.tsx";

const row = (rank: number, name: string | null, score: number) => ({
  achievedAt: `2026-11-0${String(rank)}T10:00:00.000Z`,
  profile: name === null ? null : { avatar: "snowman" as const, name },
  rank,
  score,
});
const board = (
  entries = [
    row(1, "Ada", 900),
    row(2, null, 500),
    row(3, "Bo", 400),
    row(4, null, 300),
  ],
) => ({
  endsAt: "2026-11-09T00:00:00.000Z",
  entries,
  players: entries.length,
});
const apiOf = (over: Partial<LeaderboardApi> = {}): LeaderboardApi => ({
  board: vi.fn(async () => board()),
  mine: vi.fn(async () => ({ rank: 4, score: 300 })),
  ...over,
});
const now = Date.parse("2026-11-08T00:00:00.000Z");
const show = (api: LeaderboardApi) =>
  mount(<Leaderboard api={api} gameId="arcade" now={now} />);

describe("a game's leaderboard", () => {
  it("shows the podium and the rest, names only those with a public profile linked to their page, the player's own place, and when the period resets", async () => {
    const container = await show(apiOf());
    await settle(() =>
      expect(container.querySelector(".board-podium")).not.toBeNull(),
    );
    expect(
      [...container.querySelectorAll(".board-podium__step")].map((s) =>
        s.getAttribute("data-rank"),
      ),
    ).toEqual(["1", "2", "3"]);
    expect(
      container.querySelector('a.board-who[href="/p/Ada"]'),
    ).not.toBeNull();
    expect(container.querySelectorAll(".board__row")).toHaveLength(1);
    const text = textOf(container);
    expect(text).toContain(leaderboardCopy.anonymous);
    expect(text).toContain("900");
    expect(text).toContain(leaderboardCopy.place(4, 300));
    expect(text).toContain(leaderboardCopy.resets(1, 0));
  });

  it("asks for another period when it is chosen, and marks only the one shown", async () => {
    const api = apiOf();
    const container = await show(api);
    await settle(() =>
      expect(container.querySelector(".board-podium")).not.toBeNull(),
    );
    const tab = (label: string) => {
      const found = [
        ...container.querySelectorAll<HTMLButtonElement>(".board__tab"),
      ].find((b) => b.textContent === label);
      if (found === undefined) throw new Error(`no ${label} tab`);
      return found;
    };
    const all = tab(leaderboardCopy.windows.all);
    const week = tab(leaderboardCopy.windows.week);
    expect(api.board).toHaveBeenLastCalledWith("arcade", "all");
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(week.getAttribute("aria-pressed")).toBe("false");
    click(week);
    await settle(() =>
      expect(api.board).toHaveBeenLastCalledWith("arcade", "week"),
    );
    await settle(() => expect(week.getAttribute("aria-pressed")).toBe("true"));
    expect(all.getAttribute("aria-pressed")).toBe("false");
  });

  it("says so when nobody has a score, and says the player has none when their place is empty", async () => {
    const empty = await show(
      apiOf({
        board: vi.fn(async () => board([])),
        mine: vi.fn(async () => null),
      }),
    );
    await settle(() =>
      expect(textOf(empty)).toContain(leaderboardCopy.empty.all),
    );
    expect(textOf(empty)).toContain(leaderboardCopy.noPlace);
    expect(empty.querySelector(".board-podium")).toBeNull();
  });

  it("keeps the board when the player's place cannot be read (nobody signed in), and says when the board cannot be loaded", async () => {
    const anonymous = await show(
      apiOf({ mine: vi.fn(async () => Promise.reject(new Error("401"))) }),
    );
    await settle(() =>
      expect(anonymous.querySelector(".board-podium")).not.toBeNull(),
    );
    expect(textOf(anonymous)).toContain(leaderboardCopy.noPlace);
    const broken = await show(
      apiOf({ board: vi.fn(async () => Promise.reject(new Error("down"))) }),
    );
    await settle(() =>
      expect(textOf(broken)).toContain(leaderboardCopy.failed),
    );
  });

  it("counts hours when less than a day is left, and has no reset note for all time", async () => {
    const soon = await show(
      apiOf({
        board: vi.fn(async () => ({
          ...board(),
          endsAt: "2026-11-08T05:00:00.000Z",
        })),
      }),
    );
    await settle(() =>
      expect(textOf(soon)).toContain(leaderboardCopy.resets(0, 5)),
    );
    const forever = await show(
      apiOf({ board: vi.fn(async () => ({ ...board(), endsAt: null })) }),
    );
    await settle(() =>
      expect(forever.querySelector(".board-podium")).not.toBeNull(),
    );
    expect(textOf(forever)).not.toContain("Resets in");
  });
});

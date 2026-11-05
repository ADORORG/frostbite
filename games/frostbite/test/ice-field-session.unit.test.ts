import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { createIceFieldSession } from "../src/ice-field/session.ts";
import {
  cells,
  defaultMines,
  glacierCosts,
  iceFieldMines,
  iceFieldRules,
  maxBoards,
  maxMines,
} from "../src/verifier/ice-field.ts";
import { frostbiteRules } from "../src/verifier/frostbite.ts";

const seed = 20_261_016;
const safe = (board: number, mines = defaultMines) => {
  const mine = iceFieldMines(seed, board, mines);
  return Array.from({ length: cells }, (_, tile) => tile).filter(
    (tile) => !mine.includes(tile),
  );
};
// Clears every safe tile of a board and settles it.
function clearBoard(
  session: ReturnType<typeof createIceFieldSession>,
  board: number,
) {
  for (const tile of safe(board)) session.pick(tile);
  return session.settle();
}

describe("starting a run", () => {
  it("begins on the first board with nothing earned and nothing recorded, with the game's default mines", () => {
    const session = createIceFieldSession({ seed });
    expect(session.state()).toMatchObject({
      boardIndex: 0,
      icicles: 0,
      mineCount: defaultMines,
      wins: 0,
    });
    expect(session.earned()).toEqual([]);
    expect(session.steps()).toBe(0);
    expect(session.nextGlacierCost()).toBe(glacierCosts[0]);
    expect(session.record()).toMatchObject({
      claims: [],
      config: { cabinet: "ice-field", mines: defaultMines },
      gameId: "frostbite",
      inputs: [],
      seed,
      verifier: "frostbite",
      verifierVersion: 2,
    });
  });

  it("takes another mine count, written into the record, and refuses one the rules do not allow", () => {
    expect(createIceFieldSession({ mines: 9, seed }).record().config).toEqual({
      cabinet: "ice-field",
      mines: 9,
    });
    expect(
      createIceFieldSession({ mines: maxMines, seed }).state().mineCount,
    ).toBe(maxMines);
    for (const mines of [0, maxMines + 1, 2.5])
      expect(() => createIceFieldSession({ mines, seed })).toThrow(RangeError);
  });
});

describe("recording what the player does", () => {
  it("records each input the rules accept, in order, and counts them", () => {
    const session = createIceFieldSession({ seed });
    const [first, second] = safe(0);
    expect(session.pick(first ?? 0)).toEqual({ ok: true });
    expect(session.pick(second ?? 0)).toEqual({ ok: true });
    session.settle();
    expect(session.steps()).toBe(3);
    expect(session.record().inputs).toEqual([
      { data: first, type: "pick" },
      { data: second, type: "pick" },
      { type: "settle" },
    ]);
  });

  it("records nothing for an input the rules refuse, and changes nothing", () => {
    const session = createIceFieldSession({ seed });
    const [tile] = safe(0);
    session.pick(tile ?? 0);
    const before = JSON.stringify(session.record());
    for (const refused of [
      session.pick(tile ?? 0),
      session.pick(-1),
      session.pick(cells),
      session.pick(1.5),
      session.buildGlacier(),
    ])
      expect(refused).toMatchObject({ ok: false });
    expect(session.pick(tile ?? 0)).toEqual({
      ok: false,
      reason: "that tile is already picked",
    });
    expect(session.steps()).toBe(1);
    expect(JSON.stringify(session.record())).toBe(before);
  });

  it("can take the record at any point without ending the run, and it grows as the run does", () => {
    const session = createIceFieldSession({ seed });
    session.pick(safe(0)[0] ?? 0);
    const early = session.record();
    session.pick(safe(0)[1] ?? 0);
    expect(early.inputs).toHaveLength(1);
    expect(session.record().inputs).toHaveLength(2);
  });

  it("keeps the record it handed out from changing afterwards", () => {
    const session = createIceFieldSession({ seed });
    const early = session.record();
    session.pick(safe(0)[0] ?? 0);
    expect(early.inputs).toEqual([]);
  });

  it("is the same record for the same seed and the same actions", () => {
    const play = () => {
      const session = createIceFieldSession({ seed });
      clearBoard(session, 0);
      session.buildGlacier();
      return session.record();
    };
    expect(play()).toEqual(play());
  });

  it("is always a legal run: replaying the record from its seed through the rules gives the same end state", () => {
    const session = createIceFieldSession({ seed });
    session.pick(safe(0)[0] ?? 0);
    session.pick(iceFieldMines(seed, 0, defaultMines)[0] ?? 0);
    session.pick(safe(0)[1] ?? 0);
    session.settle();
    clearBoard(session, 1);
    session.buildGlacier();
    const record = session.record();
    // Through the verifier the platform holds: the record is a legal run that earns what it claims.
    expect(replayRecord(frostbiteRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
    // And through the cabinet's rules alone it ends where the session is.
    const started = iceFieldRules.init(record.seed, { mines: defaultMines });
    if (!started.ok) throw new Error(started.reason);
    let state = started.state;
    for (const input of record.inputs) {
      const stepped = iceFieldRules.step(state, input);
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped.state;
    }
    expect(state).toEqual(session.state());
  });
});

describe("settling a board", () => {
  it("says how it ended and what it paid", () => {
    const won = createIceFieldSession({ seed });
    for (const tile of safe(0).slice(0, 3)) won.pick(tile);
    expect(won.settle()).toEqual({
      ok: true,
      settled: { gained: 83, result: "won" },
    });

    const busted = createIceFieldSession({ seed });
    busted.pick(safe(0)[0] ?? 0);
    busted.pick(iceFieldMines(seed, 0, defaultMines)[0] ?? 0);
    expect(busted.settle()).toEqual({
      ok: true,
      settled: { gained: 0, result: "busted" },
    });

    const skipped = createIceFieldSession({ seed });
    expect(skipped.settle()).toEqual({
      ok: true,
      settled: { gained: 0, result: "skipped" },
    });
  });

  it("pays the bonus for a cleared board and moves on to the next", () => {
    const session = createIceFieldSession({ seed });
    expect(clearBoard(session, 0)).toEqual({
      ok: true,
      settled: { gained: 825, result: "won" },
    });
    expect(session.state()).toMatchObject({
      boardIndex: 1,
      icicles: 825,
      wins: 1,
    });
  });

  it("is refused after the last board of a run, and nothing is recorded for it", () => {
    const session = createIceFieldSession({ seed });
    for (let board = 0; board < maxBoards - 1; board += 1) session.settle();
    const steps = session.steps();
    expect(session.settle()).toEqual({
      ok: false,
      reason: "a run has no more boards after this one",
    });
    expect(session.steps()).toBe(steps);
  });
});

describe("glaciers", () => {
  it("cost icicles, are built in order, and run out after the third", () => {
    const session = createIceFieldSession({ seed });
    expect(session.buildGlacier()).toEqual({
      ok: false,
      reason: "not enough icicles for that tier",
    });
    for (let board = 0; board < 7; board += 1) {
      clearBoard(session, board);
      while (session.buildGlacier().ok) {
        // build every tier that can be paid for
      }
    }
    expect(session.state().glacierTier).toBe(3);
    expect(session.nextGlacierCost()).toBeNull();
    expect(session.buildGlacier()).toEqual({
      ok: false,
      reason: "every glacier tier is built",
    });
    expect(session.state().icicles).toBe(
      7 * 825 - glacierCosts.reduce((a, b) => a + b, 0),
    );
  });
});

describe("announcing milestones", () => {
  it("announces first-win once, when the first board is won, and first-glacier once, when the glacier is built", () => {
    const onEarned = vi.fn();
    const session = createIceFieldSession({ onEarned, seed });
    session.pick(safe(0)[0] ?? 0);
    expect(onEarned).not.toHaveBeenCalled();
    session.settle();
    expect(onEarned.mock.calls).toEqual([["first-win"]]);
    clearBoard(session, 1);
    expect(onEarned).toHaveBeenCalledTimes(1);
    session.buildGlacier();
    expect(onEarned.mock.calls).toEqual([["first-win"], ["first-glacier"]]);
    clearBoard(session, 2);
    session.buildGlacier();
    expect(onEarned).toHaveBeenCalledTimes(2);
    expect(session.record().claims).toEqual(["first-win", "first-glacier"]);
  });

  it("announces nothing for a board that was busted or skipped, or an input that was refused", () => {
    const onEarned = vi.fn();
    const session = createIceFieldSession({ onEarned, seed });
    session.pick(iceFieldMines(seed, 0, defaultMines)[0] ?? 0);
    session.settle();
    session.settle();
    session.buildGlacier();
    session.pick(99);
    expect(onEarned).not.toHaveBeenCalled();
  });

  it("works without anyone listening", () => {
    const session = createIceFieldSession({ seed });
    session.pick(safe(0)[0] ?? 0);
    expect(session.settle()).toMatchObject({ ok: true });
  });
});

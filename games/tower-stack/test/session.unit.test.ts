import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { blockX } from "../src/rules/block.ts";
import { maxTicks } from "../src/rules/constants.ts";
import { towerRules } from "../src/rules/index.ts";
import { createRunSession } from "../src/session.ts";
import { play } from "./support/bot.ts";

const ticksOf = (inputs: readonly { data?: unknown }[]) =>
  inputs.map(({ data }) => (data as { tick: number }).tick);

// Plays a session as the bot did: ticks to each drop's tick, then drops.
function replayBy(seed: number, blocks: number, slips: readonly number[]) {
  const played = play(seed, blocks, slips);
  const onEarned = vi.fn();
  const session = createRunSession({ onEarned, seed });
  const ticks = ticksOf(played.inputs);
  played.inputs.slice(0, -1).forEach((_, at) => {
    while (session.clock() < (ticks[at] ?? 0)) session.tick();
    expect(session.drop()).toEqual({ ok: true });
  });
  return { onEarned, played, session };
}

describe("a session", () => {
  it("counts ticks, and says where the moving block is on the tick it is on", () => {
    const session = createRunSession({ seed: 7 });
    expect(session.clock()).toBe(0);
    session.tick();
    session.tick();
    expect(session.clock()).toBe(2);
    expect(session.movingX()).toBe(blockX(session.state(), 2));
  });

  it("refuses a drop on the tick the block appeared, and does not record it", () => {
    const session = createRunSession({ seed: 7 });
    expect(session.drop()).toEqual({
      ok: false,
      reason: "a block cannot be dropped on the tick it appears",
    });
    expect(session.state().height).toBe(0);
    expect(session.record().inputs.map(({ type }) => type)).toEqual(["end"]);
  });

  it("records the drops the rules accept, with their ticks, and the end", () => {
    const { played, session } = replayBy(7, 12, [0, 2, -1]);
    const record = session.record();
    expect(record.inputs).toEqual(played.inputs);
    expect(record.inputs.at(-1)?.type).toBe("end");
    expect(session.state().ended).toBe(true);
    expect(session.drop()).toEqual({ ok: false, reason: "the run has ended" });
  });

  it("makes a record the platform's replay accepts, with the milestones the player was told of, each once", () => {
    const { onEarned, played, session } = replayBy(
      20_261_030,
      40,
      [0, 0, 2, 0, -1, 1],
    );
    const record = session.record();
    const outcome = replayRecord(towerRules, record);
    expect(outcome).toMatchObject({ earned: record.claims, ok: true });
    expect(onEarned.mock.calls.map(([id]) => id).sort()).toEqual(
      [...record.claims].sort(),
    );
    expect(record.claims.length).toBeGreaterThan(5);
    expect(session.state().height).toBe(played.state.height);
  });

  it("keeps each block that was set down, and marks the perfect ones", () => {
    const { session } = replayBy(7, 6, [0]);
    const slabs = session.slabs();
    expect(slabs).toHaveLength(7);
    expect(session.earned()).toEqual(towerRules.earned(session.state()));
    expect(session.earned()).toContain("first-perfect");
    expect(slabs[0]).toMatchObject({ perfect: false, width: 48, x: 36 });
    expect(slabs.slice(1).every(({ perfect }) => perfect)).toBe(true);
    expect(session.cut()).toBeNull();
  });

  it("sets a perfect drop that is a unit or two off down as a perfect block, with nothing cut away", () => {
    const session = createRunSession({ seed: 7 });
    for (;;) {
      session.tick();
      const away = Math.abs(session.movingX() - session.state().topX);
      if (away >= 1 && away <= 3) break;
    }
    expect(session.drop()).toEqual({ ok: true });
    expect(session.slabs()[1]).toMatchObject({ perfect: true, width: 48 });
    expect(session.cut()).toBeNull();
  });

  it("notes what was cut off, on the side it hung over, with the tick it began to fall", () => {
    const seed = 11;
    const session = createRunSession({ seed });
    while (session.slabs().length < 2 && !session.state().ended) {
      session.tick();
      const before = session.state();
      const x = session.movingX();
      if (Math.abs(x - before.topX) <= 3 || x === before.topX) continue;
      session.drop();
      const cut = session.cut();
      expect(cut?.at).toBe(session.clock());
      if (x < before.topX) {
        expect(cut).toMatchObject({ width: before.topX - x, x });
      } else {
        expect(cut).toMatchObject({
          width: x - before.topX,
          x: before.topX + before.width,
        });
      }
    }
    expect(session.slabs()).toHaveLength(2);
  });

  it("ends the run when a drop misses, keeps the whole block as what fell, and refuses what comes after", () => {
    const session = createRunSession({ seed: 7 });
    // Always drops where the block is farthest from the tower: the first block cannot miss, but the tower soon narrows to where one can.
    while (!session.state().over) {
      const state = session.state();
      let worst = session.clock() + 1;
      for (let tick = worst; tick <= worst + 2 * (120 - state.width); tick += 1)
        if (
          Math.abs(blockX(state, tick) - state.topX) >
          Math.abs(blockX(state, worst) - state.topX)
        )
          worst = tick;
      while (session.clock() < worst) session.tick();
      expect(session.drop()).toEqual({ ok: true });
    }
    expect(session.state().ended).toBe(true);
    const fell = session.cut();
    expect(fell?.width).toBe(session.slabs().at(-1)?.width);
    expect(session.drop()).toEqual({ ok: false, reason: "the run has ended" });
    session.tick();
    expect(session.record().inputs.at(-1)?.type).toBe("end");
  });

  it("closes the run when it is as long as a run may be", () => {
    const session = createRunSession({ seed: 7 });
    for (let at = 0; at < maxTicks; at += 1) session.tick();
    expect(session.state().ended).toBe(true);
    expect(session.state().tick).toBe(maxTicks);
    session.tick();
    expect(session.clock()).toBe(maxTicks);
  });
});

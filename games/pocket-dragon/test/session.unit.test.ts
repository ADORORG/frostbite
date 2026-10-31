import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import {
  castlePlay,
  chapterTitles,
  hillsPlay,
  woodsPlay,
} from "../src/chapters.ts";
import { chapterIds, gameId, verifierId } from "../src/rules/constants.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import { maxTicks } from "../src/rules/woods/constants.ts";
import { createRunSession } from "../src/session.ts";
import { flatHills } from "./support/hills-world.ts";

describe("a run session", () => {
  it("records only the changes a chapter takes, with their ticks, and names the chapter in the record", () => {
    const session = createRunSession({ play: hillsPlay, seed: 12 });
    expect(session.hold("dance", true)).toEqual({ ok: true });
    expect(session.hold("left", false)).toEqual({ ok: true });
    expect(session.hold("right", true)).toEqual({ ok: true });
    for (let at = 0; at < 30; at += 1) session.tick();
    expect(session.hold("jump", true)).toEqual({ ok: true });
    expect(session.state().tick).toBe(30);
    const record = session.record();
    expect(record).toMatchObject({
      config: { cabinet: "hills" },
      gameId,
      seed: 12,
      verifier: verifierId,
    });
    expect(record.inputs).toEqual([
      { data: { on: 1, tick: 0 }, type: "right" },
      { data: { on: 1, tick: 30 }, type: "jump" },
      { data: { tick: 30 }, type: "end" },
    ]);
    expect(replayRecord(pocketDragonRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
    expect(session.hold("left", true)).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    session.tick();
    expect(session.state().tick).toBe(30);
  });

  it("tells of each milestone once, when it is earned", () => {
    const onEarned = vi.fn();
    const session = createRunSession({ onEarned, play: hillsPlay, seed: 12 });
    session.hold("right", true);
    for (let at = 0; at < 600; at += 1) session.tick();
    expect(onEarned).toHaveBeenCalledWith("first-egg");
    expect(
      onEarned.mock.calls.filter(([id]) => id === "first-egg"),
    ).toHaveLength(1);
    expect(session.earned()).toContain("first-egg");
  });

  it("closes a run that is won, lost or out of time, and a closed record can be fetched twice", () => {
    const woods = createRunSession({ play: woodsPlay, seed: 3 });
    for (let at = 0; at < maxTicks + 5; at += 1) woods.tick();
    expect(woods.state().ended).toBe(true);
    expect(woods.state().tick).toBe(maxTicks);
    expect(woods.record()).toEqual(woods.record());
    const castle = createRunSession({ play: castlePlay, seed: 3 });
    expect(castle.hold("up", true)).toEqual({ ok: true });
    expect(castle.record().config).toEqual({ cabinet: "castle" });
    const lastHeart = {
      ...hillsPlay,
      start: () => flatHills({ pits: [4, 5] }, { hearts: 1 }),
    };
    const lost = createRunSession({ play: lastHeart, seed: 29 });
    lost.hold("right", true);
    for (let at = 0; at < 600 && !lost.state().ended; at += 1) lost.tick();
    expect(lost.state().over).toBe(true);
    expect(lost.state().ended).toBe(true);
    expect(lost.record().inputs.at(-1)).toEqual({
      data: { tick: lost.state().tick },
      type: "end",
    });
  });
});

describe("the chapters", () => {
  it("are played in order under one verifier, which decides every milestone the manifest names", () => {
    expect(chapterIds.map((id) => chapterTitles[id])).toEqual([
      "Egg Hills",
      "The Whispering Woods",
      "The Guild and the Castle",
    ]);
    expect([hillsPlay.id, woodsPlay.id, castlePlay.id]).toEqual(chapterIds);
    expect(milestoneIds).toHaveLength(30);
    expect(new Set(milestoneIds).size).toBe(30);
    expect(pocketDragonRules.id).toBe(verifierId);
  });

  it("refuse a run that names no chapter, or one that does not exist", () => {
    expect(pocketDragonRules.init(1, {}).ok).toBe(false);
    expect(pocketDragonRules.init(1, { cabinet: "moon" }).ok).toBe(false);
    expect(pocketDragonRules.init(1, { cabinet: "woods" }).ok).toBe(true);
  });
});

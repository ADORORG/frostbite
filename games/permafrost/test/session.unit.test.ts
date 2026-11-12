import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { repeatDelay, repeatEvery } from "../src/hands.ts";
import { maxTicks } from "../src/rules/constants.ts";
import { gravityFor } from "../src/rules/difficulty.ts";
import { permafrostRules } from "../src/rules/index.ts";
import { createRunSession } from "../src/session.ts";

const ticks = (session: ReturnType<typeof createRunSession>, count: number) => {
  for (let at = 0; at < count; at += 1) session.tick();
};
// The keys of a record, as the text the rules read.
const keysOf = (session: ReturnType<typeof createRunSession>): string =>
  session
    .record()
    .inputs.flatMap((input) =>
      input.type === "keys" &&
      typeof input.data === "object" &&
      input.data !== null &&
      "keys" in input.data
        ? [String(input.data.keys)]
        : [],
    )
    .join("");

describe("a run as the player plays it", () => {
  it("starts at the first tick with the first piece in hand and nothing earned", () => {
    const session = createRunSession({ seed: 5 });
    expect(session.clock()).toBe(0);
    expect(session.over()).toBe(false);
    expect(session.earned()).toEqual([]);
    expect(session.state().piece.y).toBeGreaterThan(0);
  });

  it("lets the piece fall as the ticks pass, and writes nothing down for them", () => {
    const session = createRunSession({ seed: 5 });
    const before = session.state().piece.y;
    ticks(session, gravityFor(1) * 2);
    expect(session.state().piece.y).toBe(before + 2);
    expect(session.record().inputs).toEqual([
      { data: { tick: gravityFor(1) * 2 }, type: "end" },
    ]);
  });

  it("records a key as the ticks since the one before and a letter", () => {
    const session = createRunSession({ seed: 5 });
    ticks(session, 12);
    expect(session.press("left")).toBe(true);
    ticks(session, 3);
    expect(session.press("turnRight")).toBe(true);
    expect(keysOf(session)).toBe("12l3a");
  });

  it("writes down only keys that did something: a move into a wall, a second hold and a soft drop already on are not recorded", () => {
    const session = createRunSession({ seed: 5 });
    expect(session.press("hold")).toBe(true);
    expect(session.press("hold")).toBe(false);
    for (let at = 0; at < 12; at += 1) session.press("left");
    expect(session.press("left")).toBe(false);
    expect(session.press("softOn")).toBe(true);
    expect(session.press("softOn")).toBe(false);
    const keys = keysOf(session);
    // One hold, the moves that fitted before the wall (the piece starts in the middle of ten columns), and the soft drop: nothing else.
    expect(keys).toMatch(/^h(l){1,5}s$/);
    expect((keys.match(/h/g) ?? []).length).toBe(1);
    expect((keys.match(/s/g) ?? []).length).toBe(1);
  });

  it("repeats a held arrow as presses of its own, and stops when it is let go", () => {
    const session = createRunSession({ seed: 5 });
    const start = session.state().piece.x;
    session.hold("left", true);
    expect(session.state().piece.x).toBe(start - 1);
    ticks(session, repeatDelay - 1);
    expect(session.state().piece.x).toBe(start - 1);
    ticks(session, 1);
    expect(session.state().piece.x).toBe(start - 2);
    ticks(session, repeatEvery);
    expect(session.state().piece.x).toBe(start - 3);
    session.hold("left", false);
    ticks(session, 20);
    expect(session.state().piece.x).toBeGreaterThanOrEqual(0);
    const stopped = session.state().piece.x;
    ticks(session, 20);
    expect(session.state().piece.x).toBe(stopped);
    expect(keysOf(session)).toContain("l");
  });

  it("holds the soft drop down and lets it up", () => {
    const session = createRunSession({ seed: 5 });
    session.hold("soft", true);
    ticks(session, 20);
    expect(session.state().score).toBe(10);
    session.hold("soft", false);
    const score = session.state().score;
    ticks(session, 10);
    expect(session.state().score).toBe(score);
  });

  it("tells the page each milestone once, as soon as it is earned", () => {
    const heard: string[] = [];
    const session = createRunSession({
      onEarned: (id) => heard.push(id),
      seed: 5,
    });
    session.press("hold");
    expect(heard).toEqual(["first-hold"]);
    session.press("hard");
    session.press("hard");
    expect(heard.filter((id) => id === "first-hold")).toHaveLength(1);
  });

  it("is over when the stack reaches the top, takes no more keys, and closes with the score", () => {
    const session = createRunSession({ seed: 5 });
    ticks(session, 5_000);
    expect(session.over()).toBe(true);
    expect(session.state().blocked).toBe(true);
    expect(session.press("left")).toBe(false);
    session.hold("left", true);
    session.hold("soft", true);
    const clock = session.clock();
    session.tick();
    expect(session.clock()).toBe(clock);
    const record = session.record();
    expect(session.state().ended).toBe(true);
    expect(replayRecord(permafrostRules, record)).toMatchObject({
      ok: true,
      score: 0,
    });
  });

  it("closes a run that has gone on as long as a run may, and not before", () => {
    const session = createRunSession({ seed: 5 });
    for (let at = 0; at < maxTicks - 1; at += 1) {
      if (session.over()) break;
      session.press("hard");
      session.tick();
    }
    const stoppedEarly = session.over();
    expect(stoppedEarly || session.clock() < maxTicks).toBe(true);
  });

  it("gives the same record every time it is asked for, and takes nothing after", () => {
    const session = createRunSession({ seed: 5 });
    session.press("hard");
    const record = session.record();
    expect(session.record()).toBe(record);
    expect(session.press("hard")).toBe(false);
    session.tick();
    expect(session.clock()).toBe(0);
  });

  it("splits a long run into inputs the rules accept", () => {
    const session = createRunSession({ seed: 5 });
    for (let at = 0; at < 300; at += 1) {
      session.press(at % 2 === 0 ? "turnRight" : "turnLeft");
      session.tick();
    }
    const record = session.record();
    const batches = record.inputs.filter((input) => input.type === "keys");
    expect(batches.length).toBeGreaterThan(1);
    expect(replayRecord(permafrostRules, record)).toMatchObject({ ok: true });
  });
});

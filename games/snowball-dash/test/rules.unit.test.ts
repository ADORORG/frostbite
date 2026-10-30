import type { JsonValue } from "@ador/game-sdk/protocol";
import { describe, expect, it } from "vitest";

import {
  maxChoices,
  maxTicks,
  verifierId,
  verifierVersion,
} from "../src/rules/constants.ts";
import { snowballRules } from "../src/rules/index.ts";
import type { RunState } from "../src/rules/types.ts";
import { bare, rock } from "./support/states.ts";

const start = (): RunState => {
  const made = snowballRules.init(5, {});
  if (!made.ok) throw new Error(made.reason);
  return made.state;
};
const hop = (state: RunState, data: JsonValue | undefined, type = "hop") =>
  snowballRules.step(state, { data, type });
const refused = (stepped: ReturnType<typeof hop>): string =>
  stepped.ok ? "" : stepped.reason;

describe("the rules as the platform replays them", () => {
  it("name themselves and their version, and start a run on the slope the seed lays", () => {
    expect(snowballRules.id).toBe(verifierId);
    expect(snowballRules.version).toBe(verifierVersion);
    expect(start().ahead).toEqual(start().ahead);
    expect(start().tick).toBe(0);
  });

  it("take no settings, and say which they refused", () => {
    const refusal = snowballRules.init(1, { mines: 3 });
    expect(refusal).toEqual({ ok: false, reason: "no such setting: mines" });
    expect(snowballRules.init(1, {}).ok).toBe(true);
  });

  it("press and let go of the button on the tick they are told, which a run rolls on to first", () => {
    const down = hop(start(), { on: 1, tick: 20 });
    if (!down.ok) throw new Error(down.reason);
    expect(down.state.tick).toBe(20);
    expect(down.state.holding).toBe(true);
    expect(down.state.buffer).toBeGreaterThan(0);
    expect(down.state.choices).toBe(1);
    const up = hop(down.state, { on: 0, tick: 30 });
    if (!up.ok) throw new Error(up.reason);
    expect([up.state.tick, up.state.holding, up.state.choices]).toEqual([
      30,
      false,
      2,
    ]);
    expect(up.state.hops).toBe(1);
  });

  it("cut a climb short when the button is let go of, and leave a fall alone", () => {
    const down = hop(start(), { on: 1, tick: 5 });
    if (!down.ok) throw new Error(down.reason);
    const up = hop(down.state, { on: 0, tick: 9 });
    if (!up.ok) throw new Error(up.reason);
    expect(up.state.vy).toBe(9);
  });

  it("refuse a press that is not a press, with the reason", () => {
    expect(refused(hop(start(), undefined))).toBe("the input takes an object");
    expect(refused(hop(start(), { tick: 3 }))).toContain("exactly: on, tick");
    expect(refused(hop(start(), { on: 2, tick: 3 }))).toBe(
      "on must be 1 (pressed) or 0 (let go of)",
    );
    expect(refused(hop(start(), { on: 1, tick: 1.5 }))).toBe(
      "tick must be a whole number",
    );
    expect(refused(hop(start(), { on: 1, tick: maxTicks + 1 }))).toContain(
      "tick must be from 0 to",
    );
    expect(refused(hop(bare({ tick: 40 }), { on: 1, tick: 39 }))).toContain(
      "already past",
    );
  });

  it("refuse a button that is already down, or already up", () => {
    const down = hop(start(), { on: 1, tick: 5 });
    if (!down.ok) throw new Error(down.reason);
    expect(refused(hop(down.state, { on: 1, tick: 6 }))).toBe(
      "the button is already down",
    );
    expect(refused(hop(start(), { on: 0, tick: 6 }))).toBe(
      "the button is already up",
    );
  });

  it("refuse any choice once the snowball has hit a rock, and say so", () => {
    const hit = bare({ ahead: [rock(300)] });
    expect(refused(hop(hit, { on: 1, tick: 200 }))).toBe("the run is over");
  });

  it("refuse an input they do not know, and any input once the run has been closed", () => {
    expect(refused(hop(start(), { tick: 3 }, "jump"))).toBe(
      "no such input: jump",
    );
    expect(refused(hop(bare({ ended: true }), { tick: 3 }, "end"))).toBe(
      "the run has ended",
    );
  });

  it("close a run on the tick it is told, after rolling on to it", () => {
    const closed = hop(start(), { tick: 12 }, "end");
    if (!closed.ok) throw new Error(closed.reason);
    expect([closed.state.ended, closed.state.tick]).toEqual([true, 12]);
    expect(refused(hop(start(), { tick: 1.2 }, "end"))).toBe(
      "tick must be a whole number",
    );
  });

  it("end a run that has made as many choices as a record may hold", () => {
    const last = hop(bare({ choices: maxChoices - 1 }), { on: 1, tick: 4 });
    if (!last.ok) throw new Error(last.reason);
    expect(last.state.ended).toBe(true);
    const before = hop(bare({ choices: maxChoices - 2 }), { on: 1, tick: 4 });
    if (!before.ok) throw new Error(before.reason);
    expect(before.state.ended).toBe(false);
  });

  it("play the same run out the same way every time", () => {
    const play = () => {
      let state = start();
      for (const [on, tick] of [
        [1, 140],
        [0, 170],
        [1, 400],
        [0, 420],
      ] as const) {
        const next = hop(state, { on, tick });
        if (!next.ok) return JSON.stringify(next.reason);
        state = next.state;
      }
      return JSON.stringify(state);
    };
    expect(play()).toBe(play());
  });

  it("report the milestones a state has earned", () => {
    expect(snowballRules.earned(start())).toEqual([]);
    expect(snowballRules.earned(bare({ hops: 1 }))).toEqual(["first-hop"]);
  });
});

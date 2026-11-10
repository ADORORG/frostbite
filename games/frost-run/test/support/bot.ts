import type { RunInput } from "@frostbite/game-sdk/run-record";

import {
  button,
  inputGapTicks,
  noWay,
  player as body,
  powers,
} from "../../src/rules/constants.ts";
import {
  advanceTo,
  leads,
  levelAt,
  rules,
  type RunState,
  type Snowball,
} from "../../src/rules/index.ts";
import { crateRadius } from "../../src/rules/levels.ts";
import { nearestWay } from "../../src/rules/ways.ts";
import {
  contactTicks,
  danger,
  dist2,
  landIndex,
  preyOf,
  target,
  type BotStyle,
} from "./bot-eyes.ts";

export type { BotStyle } from "./bot-eyes.ts";

// A player made of rules: it heads for the nearest thing it can take, hops snowballs, ducks darts, hovers over water, shoots crates,
// grows into cages and opens frost vision for the ghost keys. It plays every round with every lead, so the tests know each can win.

export const strong: BotStyle = {
  dodge: true,
  every: 3,
  greedy: true,
  hunts: null,
  shoots: true,
  tour: false,
};
// A run that takes its time: every round's full minute, so more snowballs and darts come, to be hopped, ducked and smashed.
export const lingering: BotStyle = { ...strong, greedy: false };
export const hopper: BotStyle = { ...lingering, hunts: "hop", shoots: false };
export const hunter: BotStyle = { ...lingering, hunts: "shoot" };
export const tourist: BotStyle = { ...strong, tour: true };

interface Want {
  way: number;
  buttons: number;
}

// Goes at the ball: a shooting bot fires once it faces where the ball will be; a hopping one runs at it, hops just before it arrives and
// holds the hop (a hover, from the second round) until it is down again.
const hunt = (state: RunState, style: BotStyle, ball: Snowball): Want => {
  const p = state.player;
  const ahead = Math.sqrt(dist2(p.x, p.y, ball.x, ball.y)) / powers.boltSpeed;
  const way = nearestWay(
    ball.x + ball.vx * ahead - p.x,
    ball.y + ball.vy * ahead - p.y,
    p.facing,
  );
  if (style.hunts === "shoot")
    return { buttons: way === p.facing ? button.shoot : 0, way };
  const contact = contactTicks(state, ball);
  const hop = p.airborne || (contact !== undefined && contact <= 7);
  return { buttons: hop ? button.hop : 0, way };
};

const decide = (state: RunState, style: BotStyle): Want => {
  const p = state.player;
  const lead = leads[state.lead];
  if (lead === undefined || state.phase !== "play")
    return { buttons: 0, way: noWay };
  const prey = preyOf(state, style);
  if (prey !== undefined) return hunt(state, style, prey);
  const found = target(state, style);
  // Islets join only through the big floe in the middle: from one islet to another, cross back to the middle first.
  const here = landIndex(state, p.lastSafeX, p.lastSafeY);
  const goal =
    found !== undefined &&
    state.round === 1 &&
    here >= 1 &&
    landIndex(state, found.x, found.y) >= 1 &&
    landIndex(state, found.x, found.y) !== here
      ? { act: 0, x: 0, y: 0 }
      : found;
  let way =
    goal === undefined
      ? noWay
      : nearestWay(goal.x - p.x, goal.y - p.y, p.facing);
  let buttons = 0;
  if (goal !== undefined) {
    const d2 = dist2(p.x, p.y, goal.x, goal.y);
    if (goal.act === button.shoot) {
      if (d2 < 3500 * 3500 && way === p.facing) buttons |= button.shoot;
      if (d2 < (crateRadius + lead.radius + 120) ** 2) way = noWay;
    }
    if (goal.act === button.grow && d2 < 3200 * 3200) buttons |= button.grow;
    if (goal.act === button.vision) buttons |= button.vision;
    const keyAbove = state.items.some(
      (i) =>
        i.takenAt < 0 &&
        i.z > 1000 &&
        dist2(p.x, p.y, i.x, i.y) < (lead.radius + 900) ** 2,
    );
    if (keyAbove && !p.airborne) buttons |= button.hop;
  }
  // Over water, make for the nearest land first.
  if (
    state.round === 1 &&
    p.airborne &&
    landIndex(state, p.x, p.y) < 0 &&
    goal !== undefined
  ) {
    const land = levelAt(1).land;
    const goalLand = land[landIndex(state, goal.x, goal.y)];
    const nearestLand =
      goalLand ??
      land.reduce((a, b) =>
        dist2(p.x, p.y, a[0], a[1]) - a[2] ** 2 <
        dist2(p.x, p.y, b[0], b[1]) - b[2] ** 2
          ? a
          : b,
      );
    way = nearestWay(nearestLand[0] - p.x, nearestLand[1] - p.y, way);
  }
  // Water: hop at the edge and hold the hop to hover across.
  if (state.round === 1 && way !== noWay) {
    const step = 700;
    const [sx, sy] = [
      goal === undefined ? 0 : goal.x - p.x,
      goal === undefined ? 0 : goal.y - p.y,
    ];
    const len = Math.max(1, Math.hypot(sx, sy));
    const ahead = landIndex(
      state,
      p.x + (sx / len) * step,
      p.y + (sy / len) * step,
    );
    if ((ahead < 0 && !p.airborne) || p.airborne) buttons |= button.hop;
  }
  if (style.dodge) {
    const threat = danger(state);
    if (threat !== undefined) {
      if (threat.kind === "dart" && threat.ticks < 26 && !p.airborne)
        buttons |= button.duck;
      if (threat.kind === "ball") {
        const peak = (lead.hopSpeed * lead.hopSpeed) / (2 * body.gravity);
        const clears = peak > 2 * threat.r - 200;
        const grown = state.tick < p.growUntil;
        if (
          style.shoots &&
          state.round >= 1 &&
          threat.ticks < 30 &&
          state.tick >= p.boltReady &&
          !grown
        ) {
          buttons |= button.shoot;
          way = nearestWay(-(threat.side * 1), 0, way);
        } else if (
          clears &&
          threat.ticks < 13 &&
          threat.ticks > 5 &&
          !p.airborne &&
          !grown
        ) {
          buttons |= button.hop;
        } else if (!clears && threat.ticks < 30 && !grown) {
          way = (p.facing + (threat.side > 0 ? 4 : 12)) % 16;
        }
      }
    }
  }
  return { buttons, way };
};

// Plays a whole run. Returns the inputs (as a record holds them) and the state it ended in.
export const playBot = (
  seed: number,
  leadIndex: number,
  style: BotStyle = strong,
): { inputs: RunInput[]; state: RunState } => {
  const inputs: RunInput[] = [];
  const started = rules.init(seed, {});
  if (!started.ok) throw new Error(started.reason);
  const chosen = rules.step(started.state, { data: leadIndex, type: "lead" });
  if (!chosen.ok) throw new Error(chosen.reason);
  inputs.push({ data: leadIndex, type: "lead" });
  let state = chosen.state;
  while (!state.ended) {
    if (
      state.tick % style.every === 0 &&
      state.tick >= state.lastInputTick + inputGapTicks
    ) {
      const want = decide(state, style);
      if (want.way !== state.pad.way || want.buttons !== state.pad.buttons) {
        const input: RunInput = {
          data: [state.tick, want.way, want.buttons],
          type: "p",
        };
        const next = rules.step(state, input);
        if (!next.ok) throw new Error(`${next.reason} at ${state.tick}`);
        inputs.push(input);
        state = next.state;
      }
    }
    state = advanceTo(state, state.tick + 1);
  }
  const end: RunInput = { data: state.tick, type: "end" };
  const closed = rules.step(state, end);
  if (!closed.ok) throw new Error(closed.reason);
  inputs.push(end);
  return { inputs, state: closed.state };
};

import { stepInt } from "@ador/game-sdk/seeded";

import { grumbles, replyMost, showTicks, spiritMax } from "./constants.ts";
import type { Battle, CastleState } from "./types.ts";

// A cheer challenge, the guild's way of winning the castle: nobody is hurt. Each turn the guild puts on a show (fireworks from
// Glitchy, and a show from each friend who has joined), and the keeper's grumble goes down by the show's power, twice over for the
// keeper's favourite. The same show twice running is too tired to work. Then the keeper grumbles back and the guild's spirit dips. A
// keeper whose grumble runs out cheers up and lets the guild by; a guild whose spirit runs out takes a nap and tries again, fresh.
export const moves = [
  { id: "fireworks", member: -1, power: 3 },
  { id: "dance", member: 0, power: 2 },
  { id: "bubbles", member: 1, power: 2 },
  { id: "flowers", member: 2, power: 3 },
  { id: "lights", member: 3, power: 3 },
] as const;

// The shows the guild has now, by their place in `moves`.
export const showsOf = (state: CastleState): readonly number[] =>
  moves.flatMap((move, at) =>
    move.member < 0 || state.friends[move.member] === true ? [at] : [],
  );

export const grumbleOf = (foe: number): number => grumbles[foe] ?? 10;

export function challenge(state: CastleState, foe: number): CastleState {
  const battle: Battle = {
    choice: 0,
    firstFavourite: null,
    foe,
    grumble: grumbleOf(foe),
    last: -1,
    lastHit: 0,
    lastReply: 0,
    phase: "choose",
    since: state.tick,
    spirit: spiritMax,
  };
  return {
    ...state,
    battle,
    message: { id: `challenge-${String(foe)}`, tick: state.tick },
  };
}

export function pick(state: CastleState, by: number): CastleState {
  const { battle } = state;
  if (battle === null || battle.phase !== "choose") return state;
  const count = showsOf(state).length;
  return {
    ...state,
    battle: {
      ...battle,
      choice: (((battle.choice + by) % count) + count) % count,
    },
  };
}

export function perform(state: CastleState): CastleState {
  const { battle } = state;
  if (battle === null || battle.phase !== "choose") return state;
  const move = showsOf(state)[battle.choice] ?? 0;
  if (move === battle.last)
    return { ...state, message: { id: "tired", tick: state.tick } };
  const favourite = state.favourites[battle.foe] === move;
  const hit = (moves[move]?.power ?? 2) * (favourite ? 2 : 1);
  const firstFavourite = battle.firstFavourite ?? favourite;
  const grumble = battle.grumble - hit;
  if (grumble <= 0)
    return {
      ...state,
      battle: null,
      cheered: state.cheered.map((done, at) => done || at === battle.foe),
      message: { id: `cheered-${String(battle.foe)}`, tick: state.tick },
      perfectPicks: state.perfectPicks + (firstFavourite ? 1 : 0),
    };
  return {
    ...state,
    battle: {
      ...battle,
      firstFavourite,
      grumble,
      last: move,
      lastHit: hit,
      lastReply: 0,
      phase: "show",
      since: state.tick,
    },
  };
}

// The keeper's reply, once the show has been seen.
export function reply(state: CastleState): CastleState {
  const { battle } = state;
  if (
    battle === null ||
    battle.phase !== "show" ||
    state.tick - battle.since < showTicks
  )
    return state;
  const rolled = stepInt(state.rng, replyMost);
  const lastReply = rolled.value + 1;
  const spirit = battle.spirit - lastReply;
  if (spirit > 0)
    return {
      ...state,
      battle: {
        ...battle,
        lastReply,
        phase: "choose",
        since: state.tick,
        spirit,
      },
      rng: rolled.state,
    };
  return {
    ...state,
    battle: {
      ...battle,
      firstFavourite: null,
      grumble: grumbleOf(battle.foe),
      last: -1,
      lastReply,
      phase: "choose",
      since: state.tick,
      spirit: spiritMax,
    },
    message: { id: "nap", tick: state.tick },
    naps: state.naps + 1,
    rng: rolled.state,
  };
}

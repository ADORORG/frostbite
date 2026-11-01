import { stepInt } from "@ador/game-sdk/seeded";

import {
  grumbles,
  kingExtra,
  replyMost,
  shieldBlocks,
  showTicks,
  spiritMax,
} from "./constants.ts";
import { king } from "./places.ts";
import type { Battle, CastleState } from "./types.ts";

// A cheer challenge, the guild's way of winning the castle: nobody is hurt. It is turn by turn, like a monster battle. Each turn the
// guild picks a move: a show (fireworks from Glitchy, and one from each friend who has joined), which brings the keeper's grumble down
// by its power (twice over for the keeper's favourite; the same show twice running is too tired to work); a quick cheer (only 1, but the
// grumble back is kept small); evade (the next grumble misses; not twice running); or a secret charm. Then the keeper grumbles back with
// one of its attacks and the guild's spirit dips. A keeper whose grumble runs out cheers up; a guild whose spirit runs out takes a nap
// and carries on, fresh (the keeper stays as cheered up as it was, so a challenge can always be won in the end).
export const moves = [
  { id: "fireworks", member: -1, power: 3 },
  { id: "dance", member: 0, power: 2 },
  { id: "bubbles", member: 1, power: 2 },
  { id: "flowers", member: 2, power: 3 },
  { id: "lights", member: 3, power: 3 },
] as const;
export const quickMove = 5;
export const evadeMove = 6;
export const charmMove = 7;
export const attacksEach = 3;

// The shows the guild has now, by their place in `moves`.
export const showsOf = (state: CastleState): readonly number[] =>
  moves.flatMap((move, at) =>
    move.member < 0 || state.friends[move.member] === true ? [at] : [],
  );

// The first charm found and not yet used (spirit, star, shield), or -1.
export const heldCharm = (state: CastleState): number =>
  state.charms.findIndex((found, at) => found && state.charmsUsed[at] !== true);

// The menu, in order: the shows, then quick cheer, evade, and a charm when one is held.
export const menuOf = (state: CastleState): readonly number[] => [
  ...showsOf(state),
  quickMove,
  evadeMove,
  ...(heldCharm(state) >= 0 ? [charmMove] : []),
];

export const grumbleOf = (foe: number): number => grumbles[foe] ?? 10;

export function challenge(state: CastleState, foe: number): CastleState {
  const battle: Battle = {
    attack: -1,
    choice: 0,
    dodged: false,
    evading: false,
    firstFavourite: null,
    foe,
    gentle: false,
    grumble: grumbleOf(foe),
    last: -1,
    lastHit: 0,
    lastReply: 0,
    phase: "choose",
    shield: 0,
    since: state.tick,
    spirit: spiritMax,
    star: false,
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
  const count = menuOf(state).length;
  return {
    ...state,
    battle: {
      ...battle,
      choice: (((battle.choice + by) % count) + count) % count,
    },
  };
}

const say = (state: CastleState, id: string): CastleState => ({
  ...state,
  message: { id, tick: state.tick },
});

// A secret charm, used at once: spirit (back to full), star (the next show three times as strong), shield (blocks two grumbles).
function useCharm(state: CastleState, battle: Battle): CastleState {
  const charm = heldCharm(state);
  if (charm < 0) return state;
  const used = {
    ...state,
    charmsUsed: state.charmsUsed.map((done, at) => done || at === charm),
  };
  const changed =
    charm === 0
      ? { ...battle, spirit: spiritMax }
      : charm === 1
        ? { ...battle, star: true }
        : { ...battle, shield: battle.shield + shieldBlocks };
  return say({ ...used, battle: changed }, `charm-${String(charm)}`);
}

// Uses a move: one of `moves`, or `quickMove`, `evadeMove`, `charmMove`.
export function act(state: CastleState, move: number): CastleState {
  const { battle } = state;
  if (battle === null || battle.phase !== "choose") return state;
  if (move === charmMove) return useCharm(state, battle);
  if (move === battle.last && move !== quickMove) return say(state, "tired");
  const shown = {
    ...battle,
    dodged: false,
    last: move,
    lastReply: 0,
    phase: "show" as const,
    since: state.tick,
  };
  if (move === evadeMove)
    return {
      ...state,
      battle: { ...shown, evading: true, gentle: false, lastHit: 0 },
    };
  const favourite = state.favourites[battle.foe] === move;
  const power =
    move === quickMove
      ? 1
      : (moves[move]?.power ?? 2) * (favourite ? 2 : 1) * (battle.star ? 3 : 1);
  const firstFavourite = battle.firstFavourite ?? favourite;
  const grumble = battle.grumble - power;
  if (grumble <= 0)
    return {
      ...say(state, `cheered-${String(battle.foe)}`),
      battle: null,
      cheered: state.cheered.map((done, at) => done || at === battle.foe),
      perfectPicks: state.perfectPicks + (firstFavourite ? 1 : 0),
    };
  return {
    ...state,
    battle: {
      ...shown,
      firstFavourite,
      gentle: move === quickMove,
      grumble,
      lastHit: power,
      star: battle.star && move === quickMove,
    },
  };
}

export const perform = (state: CastleState): CastleState =>
  state.battle === null
    ? state
    : act(state, menuOf(state)[state.battle.choice] ?? 0);

// The keeper's grumble back, once the move has been seen: one of its attacks, missed if the guild evaded, blocked by a shield.
export function reply(state: CastleState): CastleState {
  const { battle } = state;
  if (
    battle === null ||
    battle.phase !== "show" ||
    state.tick - battle.since < showTicks
  )
    return state;
  const named = stepInt(state.rng, attacksEach);
  const rolled = stepInt(named.state, replyMost);
  const strength = rolled.value + 1 + (battle.foe === king ? kingExtra : 0);
  const missed = battle.evading || battle.shield > 0;
  const lost = missed ? 0 : battle.gentle ? 1 : strength;
  const next = {
    ...battle,
    attack: named.value,
    dodged: missed,
    evading: false,
    gentle: false,
    lastReply: lost,
    phase: "choose" as const,
    shield: battle.evading ? battle.shield : Math.max(0, battle.shield - 1),
    since: state.tick,
    spirit: battle.spirit - lost,
  };
  const evades = state.evades + (battle.evading ? 1 : 0);
  if (next.spirit > 0)
    return { ...state, battle: next, evades, rng: rolled.state };
  return {
    ...say(state, "nap"),
    battle: { ...next, last: -1, spirit: spiritMax },
    evades,
    naps: state.naps + 1,
    rng: rolled.state,
  };
}

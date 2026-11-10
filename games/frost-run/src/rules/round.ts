import {
  interludeTicks,
  pairTicks,
  perRound,
  roundCount,
  roundTicks,
  winShare,
  worth,
} from "./constants.ts";
import { happen, setTally, tallyOf, type Draft } from "./draft.ts";
import { placeItems, reachOf } from "./items.ts";
import type { Lead } from "./leads.ts";
import { levelAt } from "./levels.ts";
import { heightOf, radiusOf, seesFrost } from "./player.ts";
import type { Item, ItemKind, Player, RunState, Tally } from "./types.ts";
import { div } from "./ways.ts";

export const kindIndex: Record<ItemKind, number> = {
  crystal: 0,
  egg: 1,
  key: 2,
};

export const freshTally = (lead: Lead | undefined): Tally => ({
  cagesBroken: 0,
  cleared: false,
  cratesBroken: 0,
  crystal: 0,
  egg: 0,
  freeHitsLeft: lead?.freeHitsPerRound ?? 0,
  ghostKeys: 0,
  hits: 0,
  isletsVisited: 0,
  key: 0,
  timeLeftAtEnd: 0,
});

export const freshPlayer = (round: number, lead: Lead | undefined): Player => {
  const [x, y] = levelAt(round).start;
  return {
    airborne: false,
    boltReady: 0,
    ducking: false,
    facing: 0,
    growReady: 0,
    growUntil: 0,
    hoverLeft: lead?.hoverTicks ?? 0,
    hovering: false,
    lastSafeX: x,
    lastSafeY: y,
    rollReady: 0,
    rollUntil: 0,
    safeUntil: 0,
    stunUntil: 0,
    visionReady: 0,
    visionUntil: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    x,
    y,
    z: 0,
  };
};

// Sets out a round: its items, crates and cages, the player at the start and a full clock. The powers carry no cooldown into it.
export const layOut = (
  state: RunState,
  round: number,
  lead: Lead | undefined,
): Partial<Draft> => {
  const level = levelAt(round);
  const tick = state.tick;
  const player = freshPlayer(round, lead);
  return {
    bolts: [],
    cages: level.cages.map(([x, y]) => ({ brokenAt: -1, x, y })),
    crates: level.crates.map(([x, y]) => ({ brokenAt: -1, x, y })),
    darts: [],
    items: placeItems(state.seed, round, state.nextId + 1),
    nextDartAt: state.hazardClock + 240 * 3,
    nextId: state.nextId + 40,
    nextSnowballAt: state.hazardClock + 90 * 3,
    phase: "play",
    phaseTick: tick,
    player: {
      ...player,
      boltReady: tick,
      growReady: tick,
      rollReady: tick,
      visionReady: tick,
    },
    round,
    snowballs: [],
    timeLeft: roundTicks,
  };
};

// Whether the item can be taken now: not still in a crate or a cage, and a ghost only while frost vision holds.
const reachable = (draft: Draft, item: Item): boolean => {
  if (item.takenAt >= 0) return false;
  if (item.crate >= 0 && (draft.crates[item.crate]?.brokenAt ?? 0) < 0)
    return false;
  if (item.cage >= 0 && (draft.cages[item.cage]?.brokenAt ?? 0) < 0)
    return false;
  return !item.ghost || seesFrost(draft);
};

export const collect = (draft: Draft, lead: Lead): void => {
  const p = draft.player;
  const pr = radiusOf(draft, lead);
  const top = p.z + heightOf(draft, lead);
  draft.items.forEach((item, index) => {
    if (!reachable(draft, item)) return;
    const near = pr + reachOf(item.kind) + lead.reachBonus;
    if ((item.x - p.x) ** 2 + (item.y - p.y) ** 2 >= near * near) return;
    if (top < item.z - 300 || p.z > item.z + 300) return;
    draft.items[index] = { ...item, takenAt: draft.tick };
    const tally = tallyOf(draft);
    setTally(draft, {
      [item.kind]: tally[item.kind] + 1,
      ghostKeys: tally.ghostKeys + (item.ghost ? 1 : 0),
    });
    draft.score += worth[item.kind];
    if (item.kind === "crystal") {
      if (
        draft.feats.lastCrystalAt >= 0 &&
        draft.tick - draft.feats.lastCrystalAt <= pairTicks
      )
        draft.feats.quickPair = true;
      draft.feats.lastCrystalAt = draft.tick;
    }
    happen(draft, "take", item.x, item.y, kindIndex[item.kind]);
  });
};

export const totals = (
  tallies: readonly Tally[],
): Record<ItemKind, number> => ({
  crystal: tallies.reduce((sum, t) => sum + t.crystal, 0),
  egg: tallies.reduce((sum, t) => sum + t.egg, 0),
  key: tallies.reduce((sum, t) => sum + t.key, 0),
});

// What a win needs of each kind: nine in ten of all there were, rounded up.
export const needed = (kind: ItemKind): number =>
  Math.ceil((perRound[kind] * roundCount * winShare.part) / winShare.whole);

export const isWin = (tallies: readonly Tally[]): boolean => {
  const sum = totals(tallies);
  return (["crystal", "egg", "key"] as const).every(
    (kind) => sum[kind] >= needed(kind),
  );
};

const endRound = (draft: Draft): void => {
  setTally(draft, { timeLeftAtEnd: draft.timeLeft });
  draft.snowballs = [];
  draft.darts = [];
  draft.bolts = [];
  happen(draft, "round-end", draft.player.x, draft.player.y, draft.round);
  if (draft.round >= roundCount - 1) {
    draft.phase = "over";
    draft.ended = true;
    draft.won = isWin(draft.tallies);
    return;
  }
  draft.phase = "interlude";
  draft.phaseTick = draft.tick;
};

// The clock, and the end of a round: everything taken (a clear, with the time left as a bonus) or the clock run out.
export const keepTime = (draft: Draft): void => {
  draft.timeLeft -= seesFrost(draft) ? draft.tick % 2 : 1;
  if (draft.items.every((item) => item.takenAt >= 0)) {
    setTally(draft, { cleared: true });
    draft.score += div(draft.timeLeft, 6);
    happen(draft, "round-clear", draft.player.x, draft.player.y, draft.round);
    endRound(draft);
    return;
  }
  if (draft.timeLeft <= 0) {
    draft.timeLeft = 0;
    endRound(draft);
  }
};

export const interludeOver = (draft: Draft): boolean =>
  draft.phase === "interlude" && draft.tick - draft.phaseTick >= interludeTicks;

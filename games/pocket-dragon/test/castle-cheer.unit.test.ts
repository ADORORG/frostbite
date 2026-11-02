import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import {
  act,
  challenge,
  charmMove,
  evadeMove,
  grumbleOf,
  heldCharm,
  menuOf,
  moves,
  perform,
  pick,
  quickMove,
  reply,
  showsOf,
} from "../src/rules/castle/battle.ts";
import {
  showTicks,
  spiritMax,
  swiftTicks,
} from "../src/rules/castle/constants.ts";
import { spiritOf } from "../src/rules/castle/guild.ts";
import { castleChapter } from "../src/rules/castle/index.ts";
import {
  castleEarned,
  castleMilestones,
} from "../src/rules/castle/milestones.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import type { CastleState } from "../src/rules/castle/types.ts";
import { gameId, verifierId, verifierVersion } from "../src/rules/constants.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { playCastle } from "./support/castle-bot.ts";

const everyone = [true, true, true, true];
// A challenge with a keeper whose favourite show is the fireworks.
const facing = (
  friends = [false, false, false, false],
  foe = 0,
  more: Partial<CastleState> = {},
): CastleState =>
  challenge(
    { ...startCastle(4), favourites: [0, 1, 2, 3], friends, ...more },
    foe,
  );
const after = (state: CastleState, ticks: number): CastleState => ({
  ...state,
  tick: state.tick + ticks,
});
const answered = (state: CastleState): CastleState =>
  reply(after(state, showTicks));

describe("a cheer challenge", () => {
  it("offers the guild's shows, then a quick cheer and evade, and a charm when one is held", () => {
    expect(showsOf(facing())).toEqual([0]);
    expect(menuOf(facing())).toEqual([0, quickMove, evadeMove]);
    expect(menuOf(facing([true, false, true, false]))).toEqual([
      0,
      1,
      3,
      quickMove,
      evadeMove,
    ]);
    const charmed = facing(everyone, 0, { charms: [false, true, false] });
    expect(menuOf(charmed)).toEqual([
      0,
      1,
      2,
      3,
      4,
      quickMove,
      evadeMove,
      charmMove,
    ]);
    expect(pick(facing(), 1).battle?.choice).toBe(1);
    expect(pick(facing(), -1).battle?.choice).toBe(2);
    expect(pick(startCastle(4), 1)).toEqual(startCastle(4));
  });

  it("brings the grumble down by the show's power, twice over for the favourite, and the same show twice is too tired", () => {
    const shown = perform(facing(everyone));
    expect(shown.battle?.grumble).toBe(grumbleOf(0) - 6);
    expect(shown.battle?.phase).toBe("show");
    expect(perform(shown)).toEqual(shown);
    const back = answered(shown);
    expect(back.battle?.phase).toBe("choose");
    expect(back.battle?.spirit).toBeLessThan(spiritMax);
    expect(back.battle?.attack).toBeGreaterThanOrEqual(0);
    expect(reply(after(shown, showTicks - 1))).toEqual(
      after(shown, showTicks - 1),
    );
    const tired = act(back, 0);
    expect(tired.message?.id).toBe("tired");
    expect(tired.battle).toEqual(back.battle);
  });

  it("keeps a quick cheer's grumble back to one, and a quick cheer is never too tired", () => {
    let state = act(facing(everyone), quickMove);
    expect(state.battle?.lastHit).toBe(1);
    state = answered(state);
    expect(state.battle?.lastReply).toBe(1);
    expect(act(state, quickMove).battle?.phase).toBe("show");
  });

  it("makes the next grumble miss on evade, counts it, and will not evade twice running", () => {
    const evading = act(facing(), evadeMove);
    expect(evading.battle?.evading).toBe(true);
    expect(evading.battle?.grumble).toBe(grumbleOf(0));
    const missed = answered(evading);
    expect(missed.battle?.dodged).toBe(true);
    expect(missed.battle?.spirit).toBe(spiritMax);
    expect(missed.evades).toBe(1);
    expect(act(missed, evadeMove).message?.id).toBe("tired");
  });

  it("uses a secret charm at once, without a turn: spirit back to full, a star for the next show, a shield for two grumbles", () => {
    const charmed = facing(everyone, 1, { charms: [true, true, true] });
    const low = {
      ...charmed,
      battle: charmed.battle && { ...charmed.battle, spirit: 2 },
    };
    expect(heldCharm(low)).toBe(0);
    const healed = act(low, charmMove);
    expect(healed.battle?.spirit).toBe(spiritOf(low));
    expect(spiritOf(low)).toBeGreaterThan(spiritMax);
    expect(healed.charmsUsed).toEqual([true, false, false]);
    expect(healed.battle?.phase).toBe("choose");
    const starred = act(healed, charmMove);
    expect(starred.battle?.star).toBe(true);
    const tripled = act(starred, 3);
    expect(tripled.battle?.grumble).toBe(grumbleOf(1) - 9);
    expect(tripled.battle?.star).toBe(false);
    const shielded = act(answered(tripled), charmMove);
    expect(shielded.battle?.shield).toBe(2);
    expect(heldCharm(shielded)).toBe(-1);
    expect(act(shielded, charmMove)).toEqual(shielded);
    const blocked = answered(act(shielded, quickMove));
    expect(blocked.battle?.dodged).toBe(true);
    expect(blocked.battle?.shield).toBe(1);
  });

  it("cheers the keeper up once its grumble runs out, and counts a perfect pick when the favourite came first", () => {
    let state = perform(facing(everyone));
    state = perform(pick(answered(state), 3));
    expect(state.battle?.grumble).toBeGreaterThan(0);
    const battle = state.battle;
    if (battle === null) throw new Error("the challenge ended too soon");
    state = act(answered({ ...state, battle: { ...battle, grumble: 1 } }), 1);
    expect(state.battle).toBeNull();
    expect(state.cheered[0]).toBe(true);
    expect(state.message?.id).toBe("cheered-0");
    expect(state.perfectPicks).toBe(1);
    let plain = act(facing(everyone), 1);
    for (let turn = 0; plain.battle !== null && turn < 20; turn += 1)
      plain = act(answered(plain), turn % 2 === 0 ? 3 : 0);
    expect(plain.cheered[0]).toBe(true);
    expect(plain.perfectPicks).toBe(0);
  });

  it("sends a guild whose spirit runs out for a nap, and the keeper stays as cheered up as it was", () => {
    const shown = act(facing(), 0);
    const low = {
      ...shown,
      battle: shown.battle && { ...shown.battle, spirit: 1 },
    };
    const napped = answered(low);
    expect(napped.naps).toBe(1);
    expect(napped.message?.id).toBe("nap");
    expect(napped.battle?.spirit).toBe(spiritMax);
    expect(napped.battle?.grumble).toBe(grumbleOf(0) - 6);
    expect(napped.battle?.last).toBe(-1);
  });

  it("takes its presses as the menu or as hotkeys: a way moves the choice, act or a number puts on a show", () => {
    const state = facing(everyone);
    expect(castleChapter.pressed(state, "down").battle?.choice).toBe(1);
    expect(castleChapter.pressed(state, "left").battle?.choice).toBe(
      menuOf(state).length - 1,
    );
    expect(castleChapter.pressed(state, "act").battle?.phase).toBe("show");
    expect(castleChapter.pressed(state, "fire")).toEqual(state);
    expect(castleChapter.pressed(state, "show4").battle?.lastHit).toBe(
      moves[3].power,
    );
    expect(castleChapter.pressed(state, "quick").battle?.lastHit).toBe(1);
    expect(castleChapter.pressed(state, "evade").battle?.evading).toBe(true);
    expect(castleChapter.pressed(state, "charm")).toEqual(state);
    expect(castleChapter.pressed(facing(), "show2").message?.id).toBe(
      "not-yet",
    );
    const king = answered(act(facing(everyone, 3), quickMove));
    expect(king.battle?.lastReply).toBe(1);
  });
});

describe("the guild's milestones", () => {
  it("are decided by the guild, the land crossed, the keepers cheered, the charms and the time taken", () => {
    const start = startCastle(4);
    expect(castleEarned(start)).toEqual([]);
    const most = {
      ...start,
      charms: [true, false, false],
      charmsUsed: [true, false, false],
      cheered: [true, true, true, false],
      crossedRiver: true,
      escapedWoods: true,
      evades: 1,
      friends: everyone,
      perfectPicks: 1,
      plasma: { ...start.plasma, gathered: 300 },
    };
    expect(castleEarned(most)).toEqual([
      "guild-first-friend",
      "guild-full",
      "guild-river",
      "guild-escape",
      "guild-guards",
      "guild-favourite",
      "guild-evade",
      "guild-charm",
      "secret-charm",
      "metaplasma-300",
    ]);
    const done = {
      ...most,
      goldenEgg: true,
      charms: [true, true, true],
      cheered: everyone,
      finishTick: swiftTicks + 1,
      naps: 1,
      perfectPicks: 4,
    };
    expect(castleEarned(done)).toContain("guild-castle");
    expect(castleEarned(done)).not.toContain("guild-never-napped");
    expect(castleEarned(done)).not.toContain("masterful-charm");
    expect(castleEarned({ ...done, finishTick: swiftTicks, naps: 0 })).toEqual(
      castleMilestones,
    );
    expect(castleEarned({ ...done, naps: 0, perfectPicks: 3 })).not.toContain(
      "masterful-charm",
    );
  });

  // A player who reads every hint (`support/castle-bot.ts`) earns every mark, the masterful charm among them; one who leaves the charms
  // behind and puts on whatever show comes first still takes the golden egg, after a nap.
  it("can all be earned in one quest, and the golden egg can be won even played badly", () => {
    for (const seed of [4, 20_261_031]) {
      const best = playCastle(seed);
      expect(castleEarned(best.state)).toEqual(castleMilestones);
      const worst = playCastle(seed, { worstShow: true });
      expect(worst.state.goldenEgg).toBe(true);
      expect(worst.state.naps).toBeGreaterThan(0);
    }
  }, 120_000);

  it("are given again when a quest's record is replayed through the published rules", () => {
    const quest = playCastle(4);
    const record = {
      claims: [...castleEarned(quest.state)],
      config: { cabinet: "castle" },
      gameId,
      inputs: [...quest.inputs],
      schemaVersion: 1 as const,
      seed: 4,
      verifier: verifierId,
      verifierVersion,
    };
    expect(replayRecord(pocketDragonRules, record)).toEqual({
      earned: castleMilestones,
      ok: true,
    });
  }, 30_000);
});

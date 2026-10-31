import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import {
  challenge,
  grumbleOf,
  moves,
  perform,
  pick,
  reply,
  showsOf,
} from "../src/rules/castle/battle.ts";
import {
  showTicks,
  spiritMax,
  swiftTicks,
} from "../src/rules/castle/constants.ts";
import {
  castleEarned,
  castleMilestones,
} from "../src/rules/castle/milestones.ts";
import { pressCastle, startCastle } from "../src/rules/castle/tick.ts";
import type { CastleState } from "../src/rules/castle/types.ts";
import { gameId, verifierId, verifierVersion } from "../src/rules/constants.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { playCastle } from "./support/castle-bot.ts";

const everyone = [true, true, true, true];
// A challenge with the first guard, whose favourite show is the fireworks.
const facing = (friends = [false, false, false, false]): CastleState =>
  challenge({ ...startCastle(4), favourites: [0, 1, 2, 3], friends }, 0);
const after = (state: CastleState, ticks: number): CastleState => ({
  ...state,
  tick: state.tick + ticks,
});

describe("a cheer challenge", () => {
  it("offers Glitchy's fireworks, and a show for each friend who has joined", () => {
    expect(showsOf(facing())).toEqual([0]);
    expect(showsOf(facing([true, false, true, false]))).toEqual([0, 1, 3]);
    expect(showsOf(facing(everyone))).toHaveLength(moves.length);
    expect(pick(facing(), 1).battle?.choice).toBe(0);
    expect(pick(facing(everyone), -1).battle?.choice).toBe(4);
    expect(pick(startCastle(4), 1)).toEqual(startCastle(4));
  });

  it("brings the grumble down by the show's power, twice over for the keeper's favourite, and the same show twice is too tired", () => {
    const shown = perform(facing(everyone));
    expect(shown.battle?.grumble).toBe(grumbleOf(0) - 6);
    expect(shown.battle?.phase).toBe("show");
    expect(perform(shown)).toEqual(shown);
    const answered = reply(after(shown, showTicks));
    expect(answered.battle?.phase).toBe("choose");
    expect(answered.battle?.spirit).toBeLessThan(spiritMax);
    expect(answered.battle?.lastReply).toBeGreaterThanOrEqual(1);
    expect(reply(after(shown, showTicks - 1))).toEqual(
      after(shown, showTicks - 1),
    );
    const tired = perform(answered);
    expect(tired.message?.id).toBe("tired");
    expect(tired.battle).toEqual(answered.battle);
  });

  it("cheers the keeper up once its grumble runs out, and counts a perfect pick when the favourite came first", () => {
    let state = perform(facing(everyone));
    state = perform(pick(reply(after(state, showTicks)), 3));
    expect(state.battle?.grumble).toBe(1);
    state = perform(pick(reply(after(state, showTicks)), -2));
    expect(state.battle).toBeNull();
    expect(state.cheered[0]).toBe(true);
    expect(state.message?.id).toBe("cheered-0");
    expect(state.perfectPicks).toBe(1);
    let plain = perform(pick(facing(everyone), 1));
    plain = perform(pick(reply(after(plain, showTicks)), 2));
    plain = perform(pick(reply(after(plain, showTicks)), -3));
    expect(plain.cheered[0]).toBe(true);
    expect(plain.perfectPicks).toBe(0);
  });

  it("sends a guild whose spirit runs out for a nap, to try again fresh", () => {
    const shown = perform(facing());
    const low = {
      ...shown,
      battle: shown.battle && { ...shown.battle, spirit: 1 },
    };
    const napped = reply(after(low, showTicks));
    expect(napped.naps).toBe(1);
    expect(napped.message?.id).toBe("nap");
    expect(napped.battle?.spirit).toBe(spiritMax);
    expect(napped.battle?.grumble).toBe(grumbleOf(0));
    expect(napped.battle?.last).toBe(-1);
  });

  it("takes its presses as the menu: a way moves the choice, act puts on the show, fire does nothing", () => {
    const state = facing(everyone);
    expect(pressCastle(state, "down").battle?.choice).toBe(1);
    expect(pressCastle(state, "left").battle?.choice).toBe(4);
    expect(pressCastle(state, "act").battle?.phase).toBe("show");
    expect(pressCastle(state, "fire")).toEqual(state);
  });
});

describe("the guild's milestones", () => {
  it("are decided by the guild, the land crossed, the keepers cheered and the time taken", () => {
    const start = startCastle(4);
    expect(castleEarned(start)).toEqual([]);
    const most = {
      ...start,
      cheered: [true, true, true, false],
      crossedRiver: true,
      escapedWoods: true,
      friends: everyone,
      perfectPicks: 1,
    };
    expect(castleEarned(most)).toEqual([
      "guild-first-friend",
      "guild-full",
      "guild-river",
      "guild-escape",
      "guild-first-cheer",
      "guild-guards",
      "guild-favourite",
    ]);
    const done = {
      ...most,
      bannerRaised: true,
      cheered: everyone,
      finishTick: swiftTicks + 1,
      naps: 1,
    };
    expect(castleEarned(done)).toContain("guild-castle");
    expect(castleEarned(done)).not.toContain("guild-never-napped");
    expect(castleEarned(done)).not.toContain("guild-swift");
    expect(castleEarned({ ...done, finishTick: swiftTicks, naps: 0 })).toEqual(
      castleMilestones,
    );
  });

  // A player who reads every hint (`support/castle-bot.ts`) earns every mark; one who leaves Spark behind and puts on the weakest shows
  // still captures the castle, after a nap or two.
  it("can all be earned in one quest, and the castle can be captured even with the weakest shows", () => {
    for (const seed of [4, 20_261_031]) {
      const best = playCastle(seed);
      expect(castleEarned(best.state)).toEqual(castleMilestones);
      const worst = playCastle(seed, { skipSpark: true, worstShow: true });
      expect(worst.state.bannerRaised).toBe(true);
      expect(worst.state.naps).toBeGreaterThan(0);
    }
  }, 60_000);

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

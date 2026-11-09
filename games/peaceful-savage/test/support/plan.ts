import { targetOf } from "../../src/rules/act.ts";
import { clues, clueSpot, mirrors, relics } from "../../src/rules/collect.ts";
import type { HeroId, ZoneId } from "../../src/rules/constants.ts";
import { within, zoneAt } from "../../src/rules/geometry.ts";
import { greyAt, greyHomes } from "../../src/rules/greys.ts";
import {
  canRise,
  huddleSkill,
  mastered,
  skillCount,
} from "../../src/rules/growth.ts";
import { planted, sproutTicks } from "../../src/rules/garden.ts";
import { familySpots, gardenBeds, places } from "../../src/rules/layout.ts";
import { family, visionRadius } from "../../src/rules/state.ts";
import { lamps, things } from "../../src/rules/things.ts";
import { plasmaAt } from "../../src/rules/tick.ts";
import type { PlayState } from "../../src/rules/types.ts";
import { Bot, careful, type Style } from "./bot.ts";

// A whole run, room by room: the tree, Savage Vision, the deck and the lamp that would not go out; then in each room the family member
// found there, its story things, its grey one and thread, its clue, relic and mirror, its lamp, everything else a hand can touch and its
// tiny plasma; then practice to mastery, a climb up the levels at the tree, the jackets at the loom, the huddle, and the hill in the
// meadow. `skip` leaves parts out, for runs that should fall short.
export interface Plan {
  readonly lead: HeroId;
  readonly seed: number;
  readonly skip?: ReadonlySet<string>;
  readonly style?: Style;
}

const is =
  (kind: string, id?: string | number) =>
  (state: PlayState): boolean => {
    const target = targetOf(state);
    if (target === null || target.kind !== kind) return false;
    if (id === undefined) return true;
    return "id" in target ? target.id === id : target.index === id;
  };

function heal(bot: Bot, index: number): void {
  const home = greyHomes[index];
  if (home === undefined) return;
  for (
    let tries = 0;
    tries < 4 && bot.state.greys[index]?.healed !== true;
    tries += 1
  ) {
    const where = () => {
      const grey = bot.state.greys[index];
      return greyAt(home, grey?.spot ?? 0, grey?.phase ?? 0, bot.state.tick);
    };
    bot.walkTo(where(), 1_500);
    if (bot.state.greys[index]?.seen !== true) {
      bot.vision();
      bot.wait(2);
    }
    if (!within(bot.state, where(), visionRadius(bot.state)))
      throw new Error(`grey ${String(index)} out of sight`);
    bot.reach(where(), is("grey", index), 300);
  }
  const grey = bot.state.greys[index];
  if (grey === undefined) return;
  bot.reach({ x: grey.dropX, z: grey.dropZ }, is("thread", index));
}

function gatherClue(bot: Bot, index: number): void {
  const clue = clues[index];
  if (clue === undefined) return;
  const at = clueSpot(clue, bot.state.clueAt[index]);
  bot.walkTo(at, 1_200);
  if (bot.state.cluesSeen[index] !== true) {
    bot.vision();
    bot.wait(2);
  }
  bot.reach(at, is("clue", index));
}

function gatherPlasma(bot: Bot, zone: ZoneId): void {
  for (let guard = 0; guard < 20; guard += 1) {
    const next = bot.state.plasmaAt
      .map((_, mote) => mote)
      .filter(
        (mote) =>
          !bot.state.plasmaTaken[mote] &&
          zoneAt(plasmaAt(bot.state, mote)) === zone,
      )
      .map((mote) => plasmaAt(bot.state, mote))
      .sort(
        (a, b) =>
          Math.hypot(a.x - bot.state.x, a.z - bot.state.z) -
          Math.hypot(b.x - bot.state.x, b.z - bot.state.z),
      )[0];
    if (next === undefined) return;
    bot.walkTo(next, 300);
  }
}

function room(bot: Bot, zone: ZoneId, skip: ReadonlySet<string>): void {
  for (const hero of ["zora", "kai", "ali", "heerah"] as const)
    if (
      zoneAt(familySpots[hero]) === zone &&
      !family(bot.state).includes(hero) &&
      !skip.has(hero)
    )
      bot.reach(familySpots[hero], is("family", hero), 400);
  if (zone === "kitchen" && !skip.has("pancakes"))
    bot.reach(places.stove, is("story", "stove"));
  // Kai's lesson on the porch, and Zora's in the meadow: the tower built again, the garden planted.
  if (
    zone === "meadow" &&
    !skip.has("tower") &&
    family(bot.state).includes("kai")
  )
    bot.reach(places.bench, is("story", "bench"));
  if (
    zone === "meadow" &&
    !skip.has("garden") &&
    family(bot.state).includes("zora")
  )
    gardenBeds.forEach((bed, index) => bot.reach(bed, is("bed", index)));
  if (
    zone === "office" &&
    !skip.has("drawer") &&
    family(bot.state).includes("ali")
  )
    bot.reach(places.drawer, is("story", "drawer"));
  greyHomes.forEach((home, index) => {
    if (home.zone === zone && !skip.has(`grey-${String(index)}`))
      heal(bot, index);
  });
  if (skip.has("gather")) return;
  clues.forEach((clue, index) => {
    if (clue.zone === zone) gatherClue(bot, index);
  });
  relics.forEach((relic, index) => {
    if (zoneAt(relic) === zone) bot.reach(relic, is("relic", index));
  });
  mirrors.forEach((mirror, index) => {
    if (zoneAt(mirror) === zone) bot.reach(mirror, is("mirror", index));
  });
  lamps.forEach((lamp, index) => {
    if (zoneAt(lamp) === zone) bot.reach(lamp, is("lamp", index));
  });
  things.forEach((thing, index) => {
    if (zoneAt(thing) === zone && !skip.has(thing.id))
      bot.reach(thing, is("thing", index));
  });
  gatherPlasma(bot, zone);
}

// Comes back to each planted bed once it has sprouted, and tends it into bloom.
function tendGarden(bot: Bot): void {
  gardenBeds.forEach((bed, index) => {
    if (bot.state.garden[index] !== planted) return;
    const ready = (bot.state.gardenAt[index] ?? 0) + sproutTicks;
    if (bot.state.tick < ready) bot.wait(ready - bot.state.tick);
    bot.reach(bed, is("bed", index));
  });
}

// Practises each hand-key and the breath until mastered (the huddle needs family, so it waits).
function practiseAll(bot: Bot): void {
  for (let skill = 0; skill < skillCount; skill += 1) {
    if (skill === huddleSkill) continue;
    for (let guard = 0; guard < 8 && !mastered(bot.state, skill); guard += 1)
      bot.practice(skill);
  }
}

export function playWhole(plan: Plan): Bot {
  const skip = plan.skip ?? new Set<string>();
  const bot = new Bot(plan.seed, plan.style ?? careful);
  bot.lead(plan.lead);
  bot.reach({ x: 0, z: 4_600 }, is("story", "tree"));
  bot.vision();
  if (!skip.has("deck")) bot.reach(places.deck, is("story", "deck"));
  if (skip.has("sparky")) return bot;
  bot.reach(places.lamp, is("story", "lamp"));
  for (const zone of [
    "hall",
    "kitchen",
    "kids",
    "office",
    "parents",
    "meadow",
  ] as const)
    room(bot, zone, skip);
  if (!skip.has("practice")) practiseAll(bot);
  if (!skip.has("garden")) tendGarden(bot);
  for (let guard = 0; guard < 7 && canRise(bot.state); guard += 1)
    bot.reach({ x: 0, z: 4_600 }, is("story", "tree"));
  if (skip.has("jackets")) return bot;
  bot.reach(places.loom, is("story", "loom"));
  for (
    let guard = 0;
    guard < 8 && !mastered(bot.state, huddleSkill) && !skip.has("huddle");
    guard += 1
  )
    bot.practice(huddleSkill);
  if (skip.has("hill")) return bot;
  bot.walkTo(places.hill, 1_000);
  bot.playMoment();
  return bot;
}

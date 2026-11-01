import type { EffectName } from "./audio.ts";
import { evadeMove, quickMove } from "./rules/castle/battle.ts";
import type { CastleState } from "./rules/castle/types.ts";
import { striking } from "./rules/hills/boss.ts";
import { flapSpeed, jumpSpeed } from "./rules/hills/constants.ts";
import { sectionOf } from "./rules/hills/secrets.ts";
import { eggsCaught, plasmaGathered } from "./rules/hills/milestones.ts";
import type { Boss, HillsState } from "./rules/hills/types.ts";
import { chestsOpened, cluesRead, lanternsLit } from "./rules/woods/tick.ts";
import type { WoodsState } from "./rules/woods/types.ts";

// The sounds that go with what changed between two ticks of a run, in the order they would be heard. One function for each chapter.
// Metaplasma makes a soft blip for every fifth mote gathered.
const fifths = (before: number, after: number): boolean =>
  Math.floor(after / 5) > Math.floor(before / 5);
const bossLeft = (boss: Boss): number =>
  boss.ghosts.reduce((sum, ghost) => sum + Math.max(0, ghost.hp), 0) +
  Math.max(0, boss.rocket?.hp ?? 0);

function bossSounds(
  before: HillsState,
  after: HillsState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  const was = before.boss;
  const now = after.boss;
  if (was.strike === null && now.strike !== null) heard.push("warning");
  if (
    !striking(was.strike, before.tick, before.stage) &&
    striking(now.strike, after.tick, after.stage)
  )
    heard.push("laser");
  if (bossLeft(now) < bossLeft(was)) heard.push("ghost");
  if (
    now.ghosts.filter((g) => g.hp <= 0).length >
    was.ghosts.filter((g) => g.hp <= 0).length
  )
    heard.push("freed");
  if ((was.rocket?.hp ?? 0) > 0 && now.rocket !== null && now.rocket.hp <= 0)
    heard.push("burst");
  if (after.guardsCheered > before.guardsCheered) heard.push("guard");
  if (was.beaten < 0 && now.beaten >= 0) heard.push("gate");
  return heard;
}

export function hillsSounds(
  before: HillsState,
  after: HillsState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  const cheered = after.cheers > before.cheers;
  if (
    (before.hero.grounded || before.hero.coyote > 0) &&
    after.hero.vy <= -jumpSpeed + 8 &&
    !cheered
  )
    heard.push("jump");
  if (after.breaths > before.breaths) heard.push("fire");
  if (eggsCaught(after) > eggsCaught(before)) heard.push("egg");
  if (after.goldens > before.goldens) heard.push("golden");
  if (after.hasFire && !before.hasFire) heard.push("berry");
  if (after.charms > before.charms) heard.push("charm");
  if (after.meltedCount > before.meltedCount) heard.push("melt");
  if (cheered) heard.push("cheer");
  if (after.heartsLost > before.heartsLost) heard.push("hit");
  if (after.hero.sprung && !before.hero.sprung) heard.push("spring");
  if (
    after.wings > 0 &&
    after.hero.vy === -flapSpeed &&
    before.hero.vy !== -flapSpeed
  )
    heard.push("flap");
  if (after.wingsTaken && !before.wingsTaken) heard.push("wings");
  if (after.forceTaken && !before.forceTaken) heard.push("shield");
  if (after.secretsFound > before.secretsFound) heard.push("secret");
  else if (sectionOf(after.hero.x) !== sectionOf(before.hero.x))
    heard.push("whoosh");
  if (after.stagesCleared > before.stagesCleared)
    heard.push(after.finishTick === null ? "stage" : "finish");
  if (fifths(plasmaGathered(before), plasmaGathered(after)))
    heard.push("plasma");
  return [...heard, ...bossSounds(before, after)];
}

export function woodsSounds(
  before: WoodsState,
  after: WoodsState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  if (after.breaths > before.breaths) heard.push("fire");
  if (after.melted && !before.melted) heard.push("melt");
  if (lanternsLit(after) > lanternsLit(before)) heard.push("lantern");
  if (cluesRead(after) > cluesRead(before))
    heard.push(cluesRead(after) === after.clues.length ? "gate" : "clue");
  if (
    chestsOpened(after) > chestsOpened(before) ||
    (after.moonChest && !before.moonChest)
  )
    heard.push("chest");
  if (after.parts !== before.parts)
    heard.push(after.parts.every(Boolean) ? "gate" : "chest");
  if (after.eggs !== before.eggs) heard.push("egg");
  if (after.charms !== before.charms) heard.push("charm");
  if (fifths(before.plasma.gathered, after.plasma.gathered))
    heard.push("plasma");
  if (after.escaped && !before.escaped) heard.push("finish");
  const was = before.launch;
  const now = after.launch;
  if (now !== null && was !== null) {
    if (now.eggsLeft < was.eggsLeft) heard.push("launch");
    if (now.score > was.score) heard.push("target");
  }
  return heard;
}

const messageSounds: Readonly<Record<string, EffectName>> = {
  captured: "finish",
  lilies: "open",
  melted: "melt",
  nap: "nap",
  parted: "open",
  pushed: "open",
  tired: "talk",
};

const soundOf = (id: string): EffectName =>
  messageSounds[id] ??
  (id.startsWith("joined")
    ? "join"
    : id.startsWith("got")
      ? "chest"
      : id.startsWith("cheered")
        ? "cheer"
        : id.includes("charm")
          ? "charm"
          : "talk");

export function castleSounds(
  before: CastleState,
  after: CastleState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  if (after.fireTick !== before.fireTick) heard.push("fire");
  const said = after.message;
  if (said !== null && said !== before.message) heard.push(soundOf(said.id));
  const battle = after.battle;
  if (
    battle !== null &&
    battle.phase === "show" &&
    before.battle?.phase !== "show"
  )
    heard.push(
      battle.last === evadeMove
        ? "evade"
        : battle.last === quickMove
          ? "quick"
          : "show",
    );
  if (
    battle !== null &&
    battle.phase === "choose" &&
    before.battle?.phase === "show"
  )
    heard.push(battle.dodged ? "evade" : "reply");
  if (fifths(before.plasma.gathered, after.plasma.gathered))
    heard.push("plasma");
  return heard;
}

import type { EffectName } from "./audio.ts";
import type { CastleState } from "./rules/castle/types.ts";
import { jumpSpeed } from "./rules/hills/constants.ts";
import { eggsCaught } from "./rules/hills/milestones.ts";
import type { HillsState } from "./rules/hills/types.ts";
import { chestsOpened, cluesRead, lanternsLit } from "./rules/woods/tick.ts";
import type { WoodsState } from "./rules/woods/types.ts";

// The sounds that go with what changed between two ticks of a run, in the order they would be heard. One function for each chapter.
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
  if (after.meltedCount > before.meltedCount) heard.push("melt");
  if (cheered) heard.push("cheer");
  if (after.heartsLost > before.heartsLost) heard.push("hit");
  if (after.stagesCleared > before.stagesCleared)
    heard.push(after.finishTick === null ? "stage" : "finish");
  return heard;
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
  if (after.escaped && !before.escaped) heard.push("finish");
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

export function castleSounds(
  before: CastleState,
  after: CastleState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  if (after.fireTick !== before.fireTick) heard.push("fire");
  const said = after.message;
  if (said !== null && said !== before.message) {
    const id = said.id;
    heard.push(
      messageSounds[id] ??
        (id.startsWith("joined")
          ? "join"
          : id.startsWith("got")
            ? "chest"
            : id.startsWith("cheered")
              ? "cheer"
              : "talk"),
    );
  }
  const battle = after.battle;
  if (
    battle !== null &&
    battle.phase === "show" &&
    before.battle?.phase !== "show"
  )
    heard.push("show");
  if (
    battle !== null &&
    battle.lastReply > 0 &&
    battle.phase === "choose" &&
    before.battle?.phase === "show"
  )
    heard.push("reply");
  return heard;
}

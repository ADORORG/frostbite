import type { EffectName } from "./audio.ts";
import { laserPhase, waveAt } from "./rules/woods/lair.ts";
import type { SceneId, WoodsState } from "./rules/woods/types.ts";

// The sounds of the woods outside the maze (`feedback.ts` has the maze's): a scene beginning, a dragon freed from its cage, a rocket
// key found or fitted, a guard hit or sent home, a shadow dragon set free, a valve broken, an egg launched, a bump, the forcefield and
// the heart taken, a shadow dragon hatched, and DeFu's laser glowing and burning and her shockwave going off.
const sceneSounds: Readonly<Record<SceneId, EffectName>> = {
  launch: "launch",
  lair: "warning",
  peace: "finish",
  rise: "whoosh",
};

const count = (list: readonly boolean[]): number => list.filter(Boolean).length;

export function baseSounds(
  before: WoodsState,
  after: WoodsState,
): readonly EffectName[] {
  const heard: EffectName[] = [];
  const scene = after.scene;
  if (scene !== null && scene !== before.scene)
    heard.push(sceneSounds[scene.id]);
  const was = before.base;
  const now = after.base;
  if (was === null || now === null) return heard;
  if (count(now.allies) > count(was.allies)) heard.push("join");
  if (count(now.pieces) > count(was.pieces)) heard.push("chest");
  if (count(now.installed) > count(was.installed)) heard.push("gate");
  if (now.cheered > was.cheered) heard.push("cheer");
  else if (
    now.guards.some(
      (guard, at) => guard.dizzy > (was.guards[at]?.dizzy ?? 0) + 1,
    )
  )
    heard.push("guard");
  if (now.freed > was.freed) heard.push("freed");
  if (count(now.broken) > count(was.broken)) heard.push("burst");
  if (now.ammo < was.ammo) heard.push("launch");
  if (after.heartsLost > before.heartsLost) heard.push("hit");
  if (now.forcefield > was.forcefield) heard.push("shield");
  if (now.heartTaken && !was.heartTaken) heard.push("berry");
  if (now.hatched > was.hatched) heard.push("ghost");
  const glow = laserPhase(now, after.tick);
  const glowed = laserPhase(was, before.tick);
  if (glow === "glow" && glowed === null) heard.push("warning");
  if (glow === "burn" && glowed === "glow") heard.push("laser");
  if (waveAt(now, after.tick) === 1 && waveAt(was, before.tick) === 0)
    heard.push("burst");
  return heard;
}

// Flying up and down, frost vision coming on (or not being ready), and Sparky setting off and coming back with a treasure (or finding
// no nook in reach).
export function flightSounds(
  before: WoodsState,
  after: WoodsState,
): readonly EffectName[] {
  const was = before.base;
  const now = after.base;
  if (was === null || now === null) return [];
  const heard: EffectName[] = [];
  if (now.altitude > was.altitude) heard.push("wings");
  if (now.altitude < was.altitude) heard.push("flap");
  if (now.visionStart !== was.visionStart) heard.push("frost");
  if (now.trip !== null && was.trip === null) heard.push("whoosh");
  const said = after.found !== before.found ? after.found?.kind : undefined;
  if (said === "sparky") heard.push("secret");
  if (said === "weary" || said === "empty") heard.push("talk");
  return heard;
}

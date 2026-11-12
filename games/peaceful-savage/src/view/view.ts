import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  Vector3,
} from "three";

import type { HeroId } from "../rules/constants.ts";
import { mirrors } from "../rules/collect.ts";
import { greyAt, greyHomes } from "../rules/greys.ts";
import { box } from "../rules/geometry.ts";
import { familySpots, field, places, shell, ways } from "../rules/layout.ts";
import { isHero, stepOf } from "../rules/moment.ts";
import type { PlayState } from "../rules/types.ts";
import { dancing } from "./acting.ts";
import { createCameraRig, type Intent } from "./camera.ts";
import { buildFamily, type Placed } from "./family.ts";
import { createStage, qualities, type Stage } from "./stage.ts";
import { farewellShot } from "./farewell.ts";
import type { StageControl } from "./show.ts";
import { buildWorld } from "./world.ts";
import { groundAt } from "./world/meadow.ts";

// The three-dimensional view of a run: the stage, the world and the family on it, and the camera that knows them. It reads the state the
// rules keep (and the one before it, to ease between ticks) and changes nothing. Where there is no WebGL 2 it is not made, and the
// screen draws a flat map instead.
export interface ViewFrame {
  // How far between the previous tick and this one the frame falls (0 to 1).
  readonly alpha: number;
  readonly previous: PlayState;
  // The one shown in front on the turntable while nobody leads.
  readonly select: HeroId;
  // The seconds since the player last jumped (null before any jump); a jump is only seen.
  readonly jumped?: number | null;
  // The show at the end: who the player moves on the stage, and where.
  readonly stage?: StageControl | null;
  readonly state: PlayState;
  // Whether Sparky tugs the lead on, the story having stalled.
  readonly tugging?: boolean;
}

export interface DepthView {
  // The way the camera looks across the ground (x and z, not of any length), for steering by the screen.
  forward(): { readonly x: number; readonly z: number };
  show(frame: ViewFrame): void;
}

// What the camera stays inside: the house's walls, and the hedge round the meadow (beyond it are the trees).
// What the camera may not look through: the walls, the field's edge, and the wall over each doorway (a body walks under an arch; the
// camera stays on the body's side of it).
const arches = [
  box(-3_100, 2_400, -2_900, 3_800),
  box(-3_100, 9_600, -2_900, 11_000),
  box(2_900, 2_400, 3_100, 3_800),
  box(2_900, 9_600, 3_100, 11_000),
  ...ways,
];
const bounds = [...shell, ...field, ...arches];

const grounded = (one: Placed): Placed => ({
  ...one,
  at: one.at.clone().setY(one.at.y + groundAt(one.at.x, one.at.z)),
});

const metresAt = (
  point: { readonly x: number; readonly z: number },
  lift: number,
): Vector3 =>
  new Vector3(
    point.x / 1000,
    groundAt(point.x / 1000, point.z / 1000) + lift,
    point.z / 1000,
  );

// Who or what the lead is with in a moment, for the camera and for everyone's eyes.
export function focusOf(state: PlayState): Vector3 | null {
  const moment = state.moment;
  if (moment === null) return null;
  if (isHero(moment.kind)) return metresAt(familySpots[moment.kind], 1.1);
  if (moment.kind === "grey") {
    const grey = state.greys[moment.arg];
    const home = greyHomes[moment.arg];
    return grey === undefined || home === undefined
      ? null
      : metresAt(greyAt(home, grey.spot, grey.phase, state.tick), 0.3);
  }
  if (moment.kind === "mirror") {
    const mirror = mirrors[moment.arg];
    return mirror === undefined ? null : metresAt(mirror, 1.2);
  }
  if (moment.kind === "forge") return metresAt(places.lamp, 1.1);
  if (moment.kind === "weave") return metresAt(places.loom, 1);
  if (moment.kind === "drawer") return metresAt(places.drawer, 0.7);
  return null;
}

// The shot a frame asks for. Hand-keys come in close on the hands; the breath on the chest and face; a celebration pulls back to see the
// dance. On the hill the six keys go close and wide in turn, so the hands and the snake warming are both seen.
export function intentOf(state: PlayState): Intent {
  if (state.lead === null) return "select";
  if (state.cause === "grey") return "lean";
  const step = stepOf(state);
  const moment = state.moment;
  if (state.cause === "lit" || moment?.kind === "finale") {
    if (step?.kind === "huddle") return "group";
    if (step?.kind === "breath") return "breath";
    if (step?.kind === "beat" && moment !== null)
      return step.six === true && moment.step % 2 === 0 ? "finale" : "hands";
    return "finale";
  }
  if (step?.kind === "beat") return "hands";
  if (step?.kind === "breath" || step?.kind === "centre") return "breath";
  if (step?.kind === "lean") return "lean";
  if (step?.kind === "huddle") return "group";
  if (moment !== null && moment.kind !== "practice") return "talk";
  if (dancing(state)) return "dance";
  if (state.tick < state.visionUntil) return "vision";
  return "follow";
}

export function createDepthView(
  canvas: HTMLCanvasElement,
  step: number,
  now: () => number = () => performance.now(),
): DepthView | null {
  const quality = qualities[step] ?? qualities[1];
  if (quality === undefined) return null;
  const stage: Stage | null = createStage(canvas, quality);
  if (stage === null) return null;
  // Drawn in software, the glasses and the pond show no reflection (each would draw the whole scene again).
  const drawn = stage.quality;
  const world = buildWorld(
    drawn.amount,
    drawn.lights,
    stage.software ? 0 : drawn.shadows > 0 ? 512 : 256,
  );
  const family = buildFamily(drawn.detail, drawn.amount);
  stage.scene.add(world.group, family.group);
  const rig = createCameraRig();
  const chosenRing = new Mesh(
    new TorusGeometry(1, 0.035, 8, 48),
    new MeshBasicMaterial({
      blending: AdditiveBlending,
      color: "#ffc74a",
      depthWrite: false,
      transparent: true,
    }),
  );
  chosenRing.rotation.x = Math.PI / 2;
  stage.scene.add(chosenRing);
  let last: number | null = null;
  let restUntil = 0;
  let leading = false;
  let wasFarewell = false;
  let wasIntent: Intent = "select";
  let endedAt: number | null = null;
  const looking = new Vector3();
  return {
    forward() {
      stage.camera.getWorldDirection(looking);
      return { x: looking.x, z: looking.z };
    },
    show(frame) {
      // A slow picture (one drawn in software, where a frame can take a second) is drawn at most a third of the time, resting twice as
      // long as the last one took, so the page always has time to answer the player.
      const started = now();
      if (started < restUntil) return;
      stage.fit();
      const time = now() / 1000;
      const dt =
        last === null ? 1 / 60 : Math.min(0.1, Math.max(0, time - last));
      last = time;
      const { state } = frame;
      const focus = focusOf(state);
      // The end of a run plays out over some seconds: the lit tree's farewell (the family flies off), or a lead gone grey.
      const kind =
        state.cause === "lit" || state.cause === "grey" ? state.cause : null;
      endedAt = kind === null ? null : (endedAt ?? time);
      const ending = { kind, since: endedAt === null ? 0 : time - endedAt };
      family.update({
        ...frame,
        camera: stage.camera.position.clone(),
        dt,
        ending,
        lookAt: focus,
        time,
      });
      const lead = family.lead();
      const sitting = family.sitting();
      const hands =
        lead === null
          ? []
          : [
              family.characters[lead.hero].hand("L"),
              family.characters[lead.hero].hand("R"),
            ];
      world.update({
        dt,
        ending,
        hands,
        lead,
        car: family.played()?.car ?? null,
        marked: family.played()?.marked ?? null,
        sparkyAt: family.played()?.sparky ?? null,
        state,
        swing: sitting?.angle ?? 0,
        time,
        tugging: frame.tugging === true,
      });
      // The farewell is filmed at home whatever happened on the hill: the camera cuts there as it begins.
      const farewelling = ending.kind === "lit";
      if (farewelling !== wasFarewell) rig.cut();
      wasFarewell = farewelling;
      // Sitting down, the camera comes round to the front; on the swing it stands off to the side to see the whole arc.
      const intent = farewelling
        ? "farewell"
        : sitting === null
          ? intentOf(state)
          : sitting.seat.kind;
      // On the hill the camera cuts, on the beat, between the hands and the snake.
      const pair = [intent, wasIntent];
      if (pair.includes("hands") && pair.includes("finale")) rig.cut();
      wasIntent = intent;
      // Where the family stands is on the ground, which rises on the hill: the camera's heights are measured from it.
      const placed = grounded(lead ?? family.chosen(frame.select));
      const shot = farewelling
        ? farewellShot(
            ending.since,
            family.middle(),
            family.played()?.car?.aboard === true
              ? (family.played()?.car?.high ?? 0)
              : 0,
          )
        : null;
      const framed =
        shot === null
          ? placed
          : { ...placed, at: shot.anchor, height: shot.height, yaw: 0 };
      if ((lead !== null) !== leading) rig.cut();
      leading = lead !== null;
      const [left, right] = hands;
      rig.update({
        camera: stage.camera,
        dt,
        focus:
          intent === "finale"
            ? world.snake
            : intent === "select"
              ? family.stand().at
              : focus,
        framing: shot,
        ground: groundAt,
        group: family.companions().map(grounded),
        hands:
          left === undefined || right === undefined
            ? null
            : left.clone().lerp(right, 0.5),
        intent,
        lead: framed,
        walls: bounds,
      });
      stage.lens(stage.camera.fov);
      // The one who would lead stands in a ring of gold on the lawn.
      chosenRing.visible = intent === "select";
      if (chosenRing.visible) {
        chosenRing.position.copy(family.chosen(frame.select).at).setY(0.04);
        chosenRing.scale.setScalar(0.55 + Math.sin(time * 2.4) * 0.04);
      }
      stage.follow(framed.at);
      stage.warm(world.warmth);
      stage.render();
      const took = now() - started;
      restUntil = took > 40 ? now() + took * 2 : 0;
    },
  };
}

import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PointLight,
  Scene,
  type Group,
  type Mesh,
} from "three";

import {
  bubbleSpot,
  cages,
  chests,
  defu,
  guardRoutes,
  heartSpot,
  lairGate,
  lairRow,
  panels,
  valves,
} from "../rules/woods/base-map.ts";
import { laserPhase, waveAt } from "../rules/woods/lair.ts";
import { sceneTicks } from "../rules/woods/scenes.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { colour } from "../screen/palette.ts";
import { middleOf } from "../screen/woods-base-tiles.ts";
import { rocketFoot, rocketLift, shotOf, type Shot } from "./camera.ts";
import { glitchyPoint, makeCast, showCast, type Cast } from "./cast.ts";
import {
  makeLaser,
  makeParty,
  makeWave,
  setConfetti,
  setLaser,
  setSmoke,
  setWave,
  type Laser,
  type Party,
  type Wave,
} from "./effects.ts";
import { animateLand, buildLand, outerWoods, type Land } from "./land.ts";
import {
  makeFactory,
  makePlatform,
  makeRocket,
  setFactory,
  type Factory,
  type Rocket,
} from "./machines.ts";
import { toward } from "./parts.ts";
import {
  makeBubble,
  makeCage,
  makeChest,
  makeEgg,
  makeGate,
  makeHeart,
  makePanel,
  makeValve,
  setCage,
  setChest,
  setPanel,
  setValve,
  type Cage,
  type Chest,
  type Panel,
  type Valve,
} from "./props.ts";

// The woods outside the maze in three dimensions, built once: a moonlit sky and fog, light from the moon (with shadows) and from DeFu's
// lair, the land, every thing and everyone on it, and her weapons. `show` sets it all as a state of the rules says, playing the models
// on by the time since the last frame, and says where the camera should be.
export interface World {
  readonly scene: Scene;
  show(state: WoodsState, base: Base, time: number, dt: number): Shot;
}

export interface Things {
  readonly bubble: Mesh;
  readonly cages: readonly Cage[];
  readonly chests: readonly Chest[];
  readonly egg: Group;
  readonly factory: Factory;
  readonly gate: Group;
  readonly heart: Group;
  readonly panels: readonly Panel[];
  readonly rocket: Rocket;
  readonly valves: readonly Valve[];
}

const placed = <Made extends { readonly root: Group }>(
  made: Made,
  x: number,
  z: number,
): Made => {
  made.root.position.set(x, 0, z);
  return made;
};

export function makeThings(scene: Scene): Things {
  const factory = makeFactory();
  const factoryAt = middleOf("F");
  factory.root.position.set(factoryAt.x, 0, factoryAt.y);
  const platform = makePlatform();
  const platformAt = middleOf("P");
  platform.position.set(platformAt.x, 0, platformAt.y);
  const rocket = placed(makeRocket(), rocketFoot[0], rocketFoot[2]);
  const gate = makeGate();
  gate.position.set(lairGate.x + 0.5, 0, lairGate.y + 0.5);
  const things: Things = {
    bubble: makeBubble(),
    cages: cages.map((spot, ally) =>
      placed(makeCage(ally), spot.x + 0.5, spot.y + 0.5),
    ),
    chests: chests.map((spot) =>
      placed(makeChest(), spot.x + 0.5, spot.y + 0.5),
    ),
    egg: makeEgg(),
    factory,
    gate,
    heart: makeHeart(),
    panels: panels.map((spot) =>
      placed(makePanel(), spot.x + 0.5, spot.y + 0.5),
    ),
    rocket,
    valves: valves.map((spot) =>
      placed(makeValve(), spot.x + 0.5, spot.y + 0.5),
    ),
  };
  things.bubble.position.set(bubbleSpot.x + 0.5, 0.45, bubbleSpot.y + 0.5);
  things.heart.position.set(heartSpot.x + 0.5, 0.45, heartSpot.y + 0.5);
  scene.add(
    platform,
    factory.root,
    rocket.root,
    gate,
    things.bubble,
    things.heart,
    things.egg,
    ...things.cages.map((one) => one.root),
    ...things.chests.map((one) => one.root),
    ...things.panels.map((one) => one.root),
    ...things.valves.map((one) => one.root),
  );
  return things;
}

interface Lights {
  readonly lair: PointLight;
  readonly sky: HemisphereLight;
  readonly sun: DirectionalLight;
}

function makeLights(scene: Scene): Lights {
  const sky = new HemisphereLight("#a9b8ff", "#2f5a3a", 1.4);
  const sun = new DirectionalLight("#fff0d8", 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  const reach = sun.shadow.camera;
  reach.left = -13;
  reach.right = 13;
  reach.top = 13;
  reach.bottom = -13;
  reach.near = 1;
  reach.far = 50;
  const lair = new PointLight(colour.pink, 0, 12, 1.4);
  lair.position.set(defu.x + 0.5, 2.6, defu.y + 1.5);
  scene.add(sky, sun, sun.target, lair);
  return { lair, sky, sun };
}

export function showThings(
  things: Things,
  state: WoodsState,
  base: Base,
  time: number,
  dt: number,
): void {
  things.chests.forEach((chest, at) =>
    setChest(chest, base.pieces[at] === true, time, dt),
  );
  things.cages.forEach((cage, at) =>
    setCage(cage, base.allies[at] === true, time, dt),
  );
  things.valves.forEach((valve, at) =>
    setValve(valve, base.broken[at] === true, time, dt),
  );
  things.panels.forEach((panel, at) =>
    setPanel(panel, base.installed[at] === true, time),
  );
  const working = !base.broken.every(Boolean);
  setFactory(things.factory, working, time);
  const { rocket } = things;
  const launching =
    state.scene?.id === "launch"
      ? Math.min(1, (state.tick - state.scene.start) / sceneTicks.launch)
      : null;
  rocket.shield.visible = working && base.lairStart >= 0 && launching === null;
  rocket.shieldPaint.opacity = 0.16 + Math.abs(Math.sin(time * 3)) * 0.12;
  rocket.root.position.y = launching === null ? 0 : rocketLift(launching);
  rocket.flame.visible = launching !== null;
  rocket.flame.scale.y = 1 + Math.sin(time * 30) * 0.15;
  const open = base.pieces.every(Boolean);
  things.gate.position.y = toward(
    things.gate.position.y,
    open ? 1.5 : 0,
    dt,
    3,
  );
  things.gate.visible = things.gate.position.y < 1.45;
  things.bubble.visible = !base.bubbleTaken;
  things.bubble.position.y = 0.45 + Math.sin(time * 2) * 0.08;
  things.heart.visible = !base.heartTaken;
  things.heart.rotation.y = time * 2;
  const { flight } = base;
  things.egg.visible = flight !== null;
  if (flight !== null) {
    things.egg.position.set(
      toward(things.egg.position.x, flight.x + 0.5, dt, 20),
      0.45,
      toward(things.egg.position.z, flight.y + 0.5, dt, 20),
    );
    things.egg.rotation.x = time * 12;
  } else things.egg.position.set(base.x + 0.5, 0.45, base.y + 0.5);
}

export function buildWorld(): World {
  const scene = new Scene();
  scene.background = new Color("#1a0e3d");
  scene.fog = new Fog("#1a0e3d", 13, 30);
  const lights = makeLights(scene);
  const land: Land = buildLand();
  scene.add(land.root, outerWoods());
  const things = makeThings(scene);
  const cast: Cast = makeCast(guardRoutes.length);
  scene.add(cast.root);
  const laser: Laser = makeLaser();
  const wave: Wave = makeWave();
  const party: Party = makeParty();
  scene.add(laser.root, wave.root, party.confetti, ...party.smoke);
  return {
    scene,
    show(state, base, time, dt) {
      showThings(things, state, base, time, dt);
      showCast(cast, state, base, time, dt);
      animateLand(land, time);
      setLaser(laser, base.laser, laserPhase(base, state.tick), time);
      setWave(wave, waveAt(base, state.tick), time);
      const { scene: playing } = state;
      const share =
        playing === null
          ? 0
          : Math.min(1, (state.tick - playing.start) / sceneTicks[playing.id]);
      setConfetti(
        party,
        [rocketFoot[0], 0, rocketFoot[2]],
        playing?.id === "peace" ? share : null,
      );
      setSmoke(party, rocketFoot, playing?.id === "launch" ? share : null);
      const [x, z] = glitchyPoint(base, state.tick);
      const shot = shotOf(state, base, [x, 0, z]);
      const inside = z < lairRow + 1;
      lights.sky.intensity = toward(
        lights.sky.intensity,
        inside ? 0.8 : 1.4,
        dt,
        2,
      );
      lights.lair.intensity = toward(
        lights.lair.intensity,
        inside ? 9 : 0,
        dt,
        2,
      );
      lights.sun.target.position.set(...shot.look);
      lights.sun.position.set(
        shot.look[0] - 6,
        shot.look[1] + 14,
        shot.look[2] + 7,
      );
      return shot;
    },
  };
}

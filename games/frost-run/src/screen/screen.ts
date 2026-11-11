import { Fog, Vector3 } from "three";

import { leads } from "../rules/leads.ts";
import type { RunState } from "../rules/types.ts";
import { ArenaView } from "./arena.ts";
import { createCameraRig, type CameraRig, type Frame } from "./camera.ts";
import { Effects } from "./fx.ts";
import { fadeFlash, showHappening, type Moment } from "./happen.ts";
import { HazardsView } from "./hazards.ts";
import { HeroView } from "./hero.ts";
import type { Models } from "./models/load.ts";
import { PropsView } from "./props.ts";
import { shaderTime, visionDepth } from "./shaders.ts";
import { Snowfall } from "./snow.ts";
import { headingOfWay, mix, setScene } from "./space.ts";
import type { Stage } from "./stage.ts";
import { Turntable } from "./turntable.ts";

// The whole screen: the stage, the place of the round, what is in it, the hero, the effects and the camera, all drawn from the rules'
// state. `show` is called every animation frame with the state now and the state a tick before, and how far between them the moment is.
export interface Shown {
  readonly before: RunState;
  readonly now: RunState;
  readonly share: number;
}

const arenaOf = ["arena-floe", "arena-sound", "arena-crown"] as const;
const heroModel = {
  hrimm: "hero-hrimm",
  lumen: "hero-lumen",
  nib: "hero-nib",
  pip: "hero-pip",
  volt: "hero-volt",
} as const;
// Each place has its own air: the fog reaches further over the open sound, and the crown's sky is a little violet.
const air = [
  { far: 58, near: 20, sky: "#cfe8ff" },
  { far: 66, near: 24, sky: "#c9e6ff" },
  { far: 72, near: 24, sky: "#d9d2ff" },
] as const;

export class GameScreen {
  private readonly camera: CameraRig;
  private readonly arenas: ArenaView[];
  private readonly props: PropsView;
  private readonly hazards: HazardsView;
  private readonly fx: Effects;
  private readonly snow: Snowfall;
  private readonly turntable: Turntable;
  private hero: HeroView | null = null;
  private shownRound = -1;
  private lastSeq = -1;
  private runs = 0;
  private shooting = 0;
  private slow = 1;
  private ending = false;
  private readonly focus = new Vector3();
  private readonly velocity = new Vector3();
  private readonly place = new Vector3();

  constructor(
    private readonly stage: Stage,
    private readonly models: Models,
    private readonly moment: Moment,
    stillness: () => boolean,
  ) {
    this.camera = createCameraRig(stage.camera, stillness);
    this.arenas = arenaOf.map((name) => {
      const arena = new ArenaView(models(name));
      stage.scene.add(arena.group);
      return arena;
    });
    this.props = new PropsView(stage.scene, models);
    this.hazards = new HazardsView(stage.scene, models);
    this.fx = new Effects(stage.scene);
    this.snow = new Snowfall(stage.scene, 1500);
    this.turntable = new Turntable(stage.scene, models);
    stage.onQuality((quality) => this.snow.setCount(quality.snow));
    this.showArena(0);
  }

  private showArena(round: number): void {
    this.arenas.forEach(
      (arena, index) => (arena.group.visible = index === round),
    );
    const look = air[round] ?? air[0];
    const fog = this.stage.scene.fog;
    if (fog instanceof Fog) {
      fog.near = look.near;
      fog.far = look.far;
    }
    this.stage.sky.color.set(look.sky);
  }

  // The hero select, looking at hero `index`.
  select(index: number): void {
    this.turntable.shown = true;
    this.turntable.choose(index);
    this.hero?.dispose();
    this.hero = null;
    this.hazards.clear();
    this.props.layOut(-1, [], [], []);
    this.shownRound = -1;
    this.showArena(0);
    this.camera.select(this.turntable.front());
  }

  // Where on the screen the hero select's hero is to stand: the room its card leaves.
  frame(room: Frame): void {
    this.camera.frame(room);
  }

  // A run begins: the turntable goes, and the chosen hero comes on at the start of the floe.
  begin(lead: number): void {
    const chosen = leads[lead] ?? leads[0];
    if (chosen === undefined) return;
    this.runs += 1;
    this.turntable.shown = false;
    this.hero?.dispose();
    this.hero = new HeroView(this.models(heroModel[chosen.id]), chosen);
    this.stage.scene.add(this.hero.root, this.hero.blob);
    this.lastSeq = -1;
    this.shownRound = -1;
    this.ending = false;
    this.camera.chase();
    this.camera.intro();
  }

  show(dt: number, shown: Shown | null): void {
    shaderTime.value += dt * this.slow;
    if (shown === null || this.hero === null) this.idle(dt);
    else this.play(dt, shown, this.hero);
    this.fx.update(dt * this.slow);
    fadeFlash(this.stage, dt);
    this.stage.render();
  }

  private idle(dt: number): void {
    this.slow = 1;
    visionDepth.value += (0 - visionDepth.value) * (1 - Math.exp(-4 * dt));
    this.turntable.update(dt);
    for (const arena of this.arenas) arena.update(dt, 1);
    this.focus.copy(this.turntable.front());
    this.camera.update(dt, this.focus, this.velocity.set(0, 0, 0), 0);
    this.stage.aim(this.focus);
    this.snow.update(dt, this.focus, 1);
  }

  private play(
    dt: number,
    { before, now, share }: Shown,
    hero: HeroView,
  ): void {
    if (now.round !== this.shownRound) {
      this.shownRound = now.round;
      this.showArena(now.round);
      this.hazards.clear();
    }
    this.props.layOut(
      this.runs * 100_000 + now.phaseTick,
      now.items,
      now.crates,
      now.cages,
    );
    const tick = now.tick;
    const p = now.player;
    const sees = tick < p.visionUntil;
    visionDepth.value +=
      ((sees ? 1 : 0) - visionDepth.value) * (1 - Math.exp(-5 * dt));
    this.slow = 1 - 0.62 * visionDepth.value;

    for (const happening of now.happenings) {
      if (happening.seq <= this.lastSeq) continue;
      this.lastSeq = happening.seq;
      showHappening(happening, p.z / 1000, this.fx, this.camera, this.stage, {
        ...this.moment,
        shot: () => (this.shooting = 0.32),
      });
    }
    this.shooting = Math.max(0, this.shooting - dt);

    // The hero, between the last two ticks (unless it was carried somewhere new: a fall into the water, a new round).
    const was = before.round === now.round ? before.player : p;
    const jumped = Math.abs(was.x - p.x) + Math.abs(was.y - p.y) > 1500;
    const from = jumped ? p : was;
    setScene(
      this.place,
      mix(from.x, p.x, share),
      mix(from.y, p.y, share),
      mix(from.z, p.z, share),
    );
    const over = now.phase === "over";
    const resting = now.phase === "interlude";
    const cleared = now.tallies[now.round]?.cleared === true;
    hero.update(dt, {
      airborne: p.airborne && !over,
      ducking: p.ducking && !over,
      facing: headingOfWay(p.facing),
      grown: tick < p.growUntil && !over,
      hovering: p.hovering,
      lost: over && !now.won,
      place: this.place,
      rolling: tick < p.rollUntil && !over,
      safe: tick < p.safeUntil && tick >= p.stunUntil && !over && !resting,
      select: false,
      shooting: this.shooting > 0,
      speed: over || resting ? 0 : Math.hypot(p.vx, p.vy),
      stunned: tick < p.stunUntil && !over,
      won: (over && now.won) || (resting && cleared),
    });

    const arena = this.arenas[now.round];
    arena?.update(dt, this.slow);
    this.props.update(dt, this.slow, now.items, now.crates, now.cages, sees);
    const hazardsBefore = before.round === now.round ? before : now;
    this.hazards.update(dt, this.slow, share, now, hazardsBefore);

    this.focus.copy(this.place);
    this.velocity.set(p.vx * 0.06, 0, p.vy * 0.06);
    if (over && !this.ending) this.camera.finale();
    this.ending = over;
    const grown = tick < p.growUntil ? 1 : 0;
    this.camera.update(dt, this.focus, this.velocity, grown);
    arena?.clearView(dt, this.stage.camera.position, this.focus);
    this.stage.aim(this.focus);
    this.snow.update(dt, this.focus, this.slow);
  }

  // A picture of the hero for the share card: the scene as it is now, drawn once into the canvas and read back.
  snapshot(): string {
    this.stage.render();
    return this.stage.renderer.domElement.toDataURL("image/png");
  }
}

import type { RunInput } from "@frostbite/game-sdk/run-record";

import { targetOf } from "../../src/rules/act.ts";
import { type HeroId, heroIds } from "../../src/rules/constants.ts";
import { bodyRadius } from "../../src/rules/constants.ts";
import {
  blocked,
  headings,
  headingTo,
  hits,
  type Point,
  within,
  zoneAt,
} from "../../src/rules/geometry.ts";
import { walkSpeed } from "../../src/rules/state.ts";
import { savageRules } from "../../src/rules/index.ts";
import { stepOf } from "../../src/rules/moment.ts";
import { choiceIds } from "../../src/rules/moments.ts";
import { solids } from "../../src/rules/solids.ts";
import { advanceTo } from "../../src/rules/tick.ts";
import type { PlayState } from "../../src/rules/types.ts";
import { route } from "./routes.ts";

// A player for tests: it walks the house by the bot routes, presses what the rules ask for, and keeps every input it made, so a test can
// replay them. A careful player lands every beat on its tick and always says the true thing; a clumsy one is late on the beat by
// `late` ticks and falls for each trick once before answering truly.
export interface Style {
  readonly late: number;
  readonly tricked: boolean;
}

export const careful: Style = { late: 0, tricked: false };
export const clumsy: Style = { late: 8, tricked: true };

export class Bot {
  state: PlayState;
  readonly inputs: RunInput[] = [];
  private readonly fooled = new Set<string>();

  constructor(
    seed: number,
    readonly style: Style = careful,
  ) {
    const init = savageRules.init(seed, {});
    if (!init.ok) throw new Error(init.reason);
    this.state = init.state;
  }

  send(type: string, fields: Readonly<Record<string, number>> = {}): void {
    const data = { ...fields, tick: this.state.tick };
    const stepped = savageRules.step(this.state, { data, type });
    if (!stepped.ok)
      throw new Error(
        `${type} refused at ${String(this.state.tick)}: ${stepped.reason}`,
      );
    this.state = stepped.state;
    this.inputs.push({ data, type });
  }

  wait(ticks: number): void {
    this.state = advanceTo(this.state, this.state.tick + ticks);
  }

  lead(hero: HeroId): void {
    this.wait(20);
    this.send("lead", { hero: heroIds.indexOf(hero) });
  }

  private head(way: number): void {
    if (this.state.moving !== way) this.send("move", { way });
  }

  // The way toward a point; or, where something stands in that way, the nearest way round it, kept going round the same side until the
  // straight way is clear again (so a small thing dead ahead is walked round, not danced before).
  private side = 0;
  private wayTo(to: Point): number {
    const straight = headingTo(this.state, to);
    const speed = walkSpeed(this.state);
    const walls = solids(this.state);
    const clear = (way: number): boolean => {
      const [hx, hz] = headings[(way + 16) % 16] ?? [0, 0];
      return !blocked(
        {
          x: this.state.x + Math.trunc((speed * hx) / 1000),
          z: this.state.z + Math.trunc((speed * hz) / 1000),
        },
        walls,
      );
    };
    if (clear(straight)) {
      this.side = 0;
      // A way one sixteenth off the straight one is kept while it is clear: fewer turns, fewer inputs.
      const current = this.state.moving;
      const off = Math.min(
        (current - straight + 16) % 16,
        (straight - current + 16) % 16,
      );
      return current >= 0 && off <= 1 && clear(current) ? current : straight;
    }
    const turns = [1, 2, 3, 4, 5, 6];
    const order =
      this.side === 0
        ? turns.flatMap((turn) => [turn, -turn])
        : [
            ...turns.map((turn) => turn * this.side),
            ...turns.map((turn) => -turn * this.side),
          ];
    for (const turn of order) {
      const way = (straight + turn + 16) % 16;
      if (!clear(way)) continue;
      this.side = Math.sign(turn);
      return way;
    }
    return straight;
  }

  // Walks toward a point until within `near` of it, or until a moment takes the lead (the hill calls the family).
  private walkStraight(to: Point, near: number): void {
    for (let guard = 0; guard < 4_000; guard += 1) {
      if (this.state.moment !== null || this.state.ended) return;
      if (within(this.state, to, near)) {
        this.head(-1);
        return;
      }
      this.head(this.wayTo(to));
      this.wait(1);
    }
    throw new Error(
      `stuck walking to ${String(to.x)},${String(to.z)} at ${String(this.state.x)},${String(this.state.z)}`,
    );
  }

  walkTo(to: Point, near = 500): void {
    const points = route(this.state, to);
    points.forEach((point, index) =>
      this.walkStraight(point, index === points.length - 1 ? near : 150),
    );
  }

  // The place nearest the bot where a body can stand next to a thing set against a wall or on a piece of furniture.
  standFor(to: Point): Point {
    let at = to;
    const from = this.state;
    const far = (point: Point) =>
      Math.hypot(point.x - from.x, point.z - from.z);
    for (let pass = 0; pass < 4; pass += 1) {
      const wall = solids(this.state).find((each) => hits(at, each));
      if (wall === undefined) return at;
      const out = bodyRadius + 40;
      const pushes: readonly Point[] = [
        { x: wall.x0 - out, z: at.z },
        { x: wall.x1 + out, z: at.z },
        { x: at.x, z: wall.z0 - out },
        { x: at.x, z: wall.z1 + out },
      ].filter(
        (point) =>
          within(point, to, 800) &&
          !hits(point, wall) &&
          zoneAt(point) === zoneAt(to),
      );
      at = pushes.reduce(
        (best, next) => (far(next) < far(best) ? next : best),
        pushes[0] ?? to,
      );
    }
    return at;
  }

  // Walks to a thing and reaches for it, making sure it is the thing the act key would reach.
  reach(to: Point, check: (state: PlayState) => boolean, near = 150): void {
    this.walkTo(this.standFor(to), near);
    if (!check(this.state))
      throw new Error(
        `not in reach of ${JSON.stringify(to)} via ${JSON.stringify(this.standFor(to))} at ${String(this.state.x)},${String(this.state.z)}: ${JSON.stringify(targetOf(this.state))}`,
      );
    this.send("act");
    this.playMoment();
  }

  // Plays whatever moment the lead is in, to its end.
  playMoment(): void {
    for (let guard = 0; guard < 200 && this.state.moment !== null; guard += 1) {
      const { moment } = this.state;
      const step = stepOf(this.state);
      if (step === null) return;
      if (step.kind === "beat") {
        this.wait(
          Math.max(0, moment.target + this.style.late - this.state.tick),
        );
        this.send("act");
      } else if (
        step.kind === "lean" ||
        step.kind === "huddle" ||
        step.kind === "centre"
      )
        this.send("act");
      else if (step.kind === "choose") {
        const truth = this.state.answers[choiceIds.indexOf(step.choice)] ?? 0;
        const fall = this.style.tricked && !this.fooled.has(step.choice);
        this.fooled.add(step.choice);
        this.send("choose", { option: fall ? 1 - truth : truth });
      } else {
        this.send("act");
        this.wait(120);
        this.send("release");
        this.wait(181);
      }
    }
  }

  practice(skill: number): void {
    this.send("practice", { skill });
    this.playMoment();
  }

  vision(): void {
    if (this.state.tick < this.state.visionReady)
      this.wait(this.state.visionReady - this.state.tick);
    this.send("vision");
  }

  finish(): void {
    if (!this.state.ended) this.send("end");
  }
}

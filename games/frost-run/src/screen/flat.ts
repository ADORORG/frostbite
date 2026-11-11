import { cueOf } from "../cues.ts";
import { leads, type LeadId } from "../rules/leads.ts";
import { cageRing, cageSpike, crateRadius, levelAt } from "../rules/levels.ts";
import type { Item, RunState } from "../rules/types.ts";
import { stepOf } from "../rules/ways.ts";
import type { Moment } from "./happen.ts";

// The run drawn flat, from above, for a browser that cannot draw 3D: the land, the rocks, crates and cages, the treasure, the snowballs and
// darts, and the hero, all from the rules' state, with the same sounds and the same orange flash as the 3D screen. It is plainer, but a run
// is the same run, so a player whose browser has no WebGL can still play and earn everything.
export interface FlatShown {
  readonly now: RunState;
}

const colours = {
  dart: "#dff6ff",
  edge: "#9fd8f2",
  egg: "#c9bdea",
  key: "#bfeaff",
  land: "#16232d",
  mint: "#3FE0A0",
  rock: "#4a5866",
  snow: "#f4f8ff",
  water: "#0B0A08",
} as const;
const heroColour: Readonly<Record<LeadId, string>> = {
  hrimm: "#cfe8ff",
  lumen: "#fff1c2",
  nib: "#9be7c4",
  pip: "#f4f8ff",
  volt: "#7cf9ff",
};
// How much of the round's land the picture shows around it, in millimetres.
const margin = 2500;

export class FlatScreen {
  private lead = 4;
  private lastSeq = -1;
  private scale = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly context: CanvasRenderingContext2D | null,
    private readonly moment: Moment,
  ) {}

  select(index: number): void {
    this.lead = index;
  }

  begin(lead: number): void {
    this.lead = lead;
    this.lastSeq = -1;
  }

  resize(ratio: number): void {
    const box = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(box.width * ratio));
    this.canvas.height = Math.max(1, Math.round(box.height * ratio));
  }

  show(shown: FlatShown | null): void {
    if (shown !== null) this.cue(shown.now);
    const context = this.context;
    if (context === null) return;
    const round = shown?.now.round ?? 0;
    const level = levelAt(round);
    const { height, width } = this.canvas;
    let reach = 0;
    for (const [x, y, r] of level.land)
      reach = Math.max(reach, Math.hypot(x, y) + r);
    this.scale = Math.min(width, height) / (2 * (reach + margin));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = colours.water;
    context.fillRect(0, 0, width, height);
    context.setTransform(this.scale, 0, 0, this.scale, width / 2, height / 2);
    context.lineWidth = 2 / this.scale;
    for (const [x, y, r] of level.land)
      this.disc(context, x, y, r, colours.land, colours.edge);
    for (const [x, y, r] of level.solids)
      this.disc(context, x, y, r, colours.rock, null);
    if (shown === null) {
      const [x, y] = level.start;
      this.hero(context, x, y, 8);
      return;
    }
    this.things(context, shown.now);
  }

  private cue(state: RunState): void {
    for (const happening of state.happenings) {
      if (happening.seq <= this.lastSeq) continue;
      this.lastSeq = happening.seq;
      const cue = cueOf(happening);
      if (cue.sfx !== null) this.moment.sfx(cue.sfx);
      if (cue.flash) this.moment.flash();
    }
  }

  private things(context: CanvasRenderingContext2D, state: RunState): void {
    const sees = state.tick < state.player.visionUntil;
    state.crates.forEach((crate) => {
      if (crate.brokenAt >= 0) return;
      const side = crateRadius * 1.6;
      context.fillStyle = colours.edge;
      context.fillRect(crate.x - side / 2, crate.y - side / 2, side, side);
    });
    state.cages.forEach((cage) => {
      if (cage.brokenAt >= 0) return;
      for (const [dx, dy] of cageRing)
        this.disc(
          context,
          cage.x + dx,
          cage.y + dy,
          cageSpike,
          colours.key,
          null,
        );
    });
    for (const item of state.items)
      if (item.takenAt < 0 && (!item.ghost || sees)) this.item(context, item);
    for (const ball of state.snowballs)
      this.disc(context, ball.x, ball.y, ball.r, colours.snow, null);
    context.strokeStyle = colours.dart;
    for (const dart of state.darts) {
      context.beginPath();
      context.moveTo(dart.x, dart.y);
      context.lineTo(dart.x - dart.vx * 6, dart.y - dart.vy * 6);
      context.stroke();
    }
    for (const bolt of state.bolts)
      this.disc(context, bolt.x, bolt.y, 220, colours.mint, null);
    const { facing, x, y } = state.player;
    this.hero(context, x, y, facing);
  }

  private item(context: CanvasRenderingContext2D, item: Item): void {
    const size = 520;
    context.fillStyle = colours[item.kind === "crystal" ? "mint" : item.kind];
    context.beginPath();
    if (item.kind === "crystal") {
      context.moveTo(item.x, item.y - size);
      context.lineTo(item.x + size * 0.7, item.y);
      context.lineTo(item.x, item.y + size);
      context.lineTo(item.x - size * 0.7, item.y);
      context.closePath();
    } else if (item.kind === "egg")
      context.ellipse(
        item.x,
        item.y,
        size * 0.6,
        size * 0.8,
        0,
        0,
        Math.PI * 2,
      );
    else {
      context.arc(item.x, item.y - size * 0.4, size * 0.4, 0, Math.PI * 2);
      context.rect(
        item.x - size * 0.12,
        item.y - size * 0.1,
        size * 0.24,
        size,
      );
    }
    context.fill();
  }

  private hero(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    facing: number,
  ): void {
    const lead = leads[this.lead] ?? leads[0];
    const radius = 520;
    this.disc(
      context,
      x,
      y,
      radius,
      heroColour[lead?.id ?? "pip"],
      colours.edge,
    );
    const [dx, dy] = stepOf(facing);
    context.strokeStyle = colours.water;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (dx * radius) / 1000, y + (dy * radius) / 1000);
    context.stroke();
  }

  private disc(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    fill: string,
    edge: string | null,
  ): void {
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fillStyle = fill;
    context.fill();
    if (edge === null) return;
    context.strokeStyle = edge;
    context.stroke();
  }

  // The picture as it is now, for the share card.
  snapshot(): string {
    return this.canvas.toDataURL("image/png");
  }
}

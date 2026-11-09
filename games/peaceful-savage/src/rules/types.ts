import type { HeroId } from "./constants.ts";
import type { MomentKind } from "./moments.ts";

// A moment the lead is in the middle of: which one, which step, and when that step began. A beat's target is the tick it lands on; a
// breath remembers when the breath in began (or -1 before it has) and when the breath out ends (or -1 before it has begun).
export interface Moment {
  // The grey one a whisper is from, or the mirror a re-centring is at, or -1.
  readonly arg: number;
  readonly exhaleUntil: number;
  readonly holding: number;
  readonly kind: MomentKind;
  readonly since: number;
  // The skill a practice is for (0 to 5 the hand-keys, 6 the breath), or -1.
  readonly skill: number;
  readonly step: number;
  readonly target: number;
}

// A grey one: which of its three places it is at, when its circling began, whether it has been seen and healed, and its thread: held
// (0), dropped where it was healed (1), or picked up (2).
export interface Grey {
  readonly dropX: number;
  readonly dropZ: number;
  readonly fooled: number;
  readonly healed: boolean;
  readonly phase: number;
  readonly seen: boolean;
  readonly spot: number;
  readonly thread: 0 | 1 | 2;
}

// What just happened, for the page's sounds and the view's flourishes. The rules never read it back.
export type NewsKind =
  | "beat-good"
  | "beat-miss"
  | "beat-perfect"
  | "breath-in"
  | "breath-out"
  | "breath-miss"
  | "drawer"
  | "door"
  | "found"
  | "healed"
  | "jackets"
  | "lamp"
  | "lit"
  | "moment"
  | "rise"
  | "sparky"
  | "thing"
  | "thread"
  | "touch"
  | "tricked"
  | "vision"
  | "deck"
  | "pancakes"
  | "plasma"
  | "clue"
  | "relic"
  | "level"
  | "mastered"
  | "mirror"
  | "power"
  | "reflected"
  | "planted"
  | "bloomed"
  | "tower"
  | "sensed"
  | "greying"
  | "joined";

export interface News {
  readonly detail: string;
  readonly kind: NewsKind;
  readonly tick: number;
}

// A run, as the rules hold it. The lead is null until the player chooses who leads.
export interface PlayState {
  readonly answers: readonly number[];
  readonly beatsGood: number;
  readonly beatsMissed: number;
  readonly beatsPerfect: number;
  readonly breaths: number;
  // Clues: where each lies (one of two places), whether it has been seen in vision, and whether it has been taken.
  readonly clueAt: readonly number[];
  readonly cluesSeen: readonly boolean[];
  readonly cluesTaken: readonly boolean[];
  // How the run ended: left where it stood, the tree lit, or the lead gone grey (taken into the sly snakes' coil).
  readonly cause: "grey" | "left" | "lit" | null;
  readonly colour: readonly number[];
  readonly deck: boolean;
  readonly drawer: boolean;
  readonly ended: boolean;
  readonly facing: number;
  readonly finalePerfect: number;
  // Zora's garden in the meadow: each bed bare (0), planted (1) or in bloom (2), and the tick it was planted on (or -1).
  readonly garden: readonly number[];
  readonly gardenAt: readonly number[];
  readonly greyTricks: number;
  // How grey the lead has gone from tricks believed with their spark already low (0 to 3; at 3 the run ends).
  readonly greyed: number;
  readonly greys: readonly Grey[];
  readonly jackets: boolean;
  readonly lamps: readonly boolean[];
  readonly lampsAllOn: boolean;
  readonly lead: HeroId | null;
  readonly level: number;
  readonly light: number;
  readonly mastery: readonly number[];
  readonly mirrorForce: number;
  readonly mirrorsUsed: readonly boolean[];
  readonly moment: Moment | null;
  readonly moving: number;
  // Whether the lead runs when they walk (the player holds Shift, or drags further).
  readonly hurrying: boolean;
  readonly news: News | null;
  readonly pancakes: boolean;
  readonly party: readonly HeroId[];
  // Tiny plasma: how much is gathered, and for each mote which open point of its room it lies on and whether it is taken.
  readonly plasma: number;
  readonly plasmaAt: readonly number[];
  readonly plasmaTaken: readonly boolean[];
  readonly relicsTaken: readonly boolean[];
  readonly score: number;
  readonly seed: number;
  readonly spark: number;
  readonly sparky: boolean;
  readonly thingsOn: readonly boolean[];
  readonly thingsTouched: readonly boolean[];
  readonly threads: number;
  readonly tick: number;
  readonly touchedTree: boolean;
  // Kai's crystal tower, built again on his workbench.
  readonly tower: boolean;
  // The tick from which the recovered tree can power the lead up again.
  readonly treeReady: number;
  readonly tricks: number;
  readonly visionReady: number;
  readonly visionUntil: number;
  readonly visionUses: number;
  readonly x: number;
  readonly z: number;
}

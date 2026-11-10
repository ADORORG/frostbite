export type ItemKind = "crystal" | "egg" | "key";
export type RoundPhase = "play" | "interlude" | "over";
export type HappeningKind =
  | "take"
  | "hit"
  | "free-hit"
  | "splash"
  | "plunge"
  | "shatter"
  | "crush"
  | "burst"
  | "crate"
  | "cage"
  | "hop"
  | "land"
  | "roll"
  | "bolt"
  | "grow"
  | "vision"
  | "round-clear"
  | "round-end"
  | "round-start"
  | "dart";

// Something the rules decided happened, kept for a moment so the screen can show it and the speakers play it.
export interface Happening {
  // A running count, so the screen can tell which happenings it has not shown yet.
  readonly seq: number;
  readonly tick: number;
  readonly kind: HappeningKind;
  readonly x: number;
  readonly y: number;
  // What it was about: an item's kind, a snowball's size, the number of the round.
  readonly detail: number;
}

export interface Item {
  readonly id: number;
  readonly kind: ItemKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  // Only seen and taken while frost vision holds.
  readonly ghost: boolean;
  // The crate or ice cage it waits in, if any (its index), which must break first.
  readonly crate: number;
  readonly cage: number;
  readonly takenAt: number;
}

export interface Breakable {
  readonly x: number;
  readonly y: number;
  readonly brokenAt: number;
}

export interface Snowball {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly r: number;
  readonly big: boolean;
  // Rolling from this time on the hazard clock; before it, the snowball is still dropping in where it will start.
  readonly rollsAt: number;
  // The nearest its edge came to the player's, for a close shave, and whether it went under a hop.
  readonly nearest: number;
  readonly hoppedOver: boolean;
}

export interface Dart {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly fliesAt: number;
  readonly dodged: boolean;
  readonly travelled: number;
  readonly range: number;
}

export interface Bolt {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly until: number;
}

export interface Player {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  // The way it faces, one of sixteen.
  readonly facing: number;
  readonly airborne: boolean;
  readonly ducking: boolean;
  readonly hoverLeft: number;
  readonly hovering: boolean;
  readonly rollUntil: number;
  readonly rollReady: number;
  readonly boltReady: number;
  readonly growUntil: number;
  readonly growReady: number;
  readonly visionUntil: number;
  readonly visionReady: number;
  readonly stunUntil: number;
  readonly safeUntil: number;
  readonly lastSafeX: number;
  readonly lastSafeY: number;
}

export interface Pad {
  readonly way: number;
  readonly buttons: number;
}

// What one round has gathered and done.
export interface Tally {
  readonly crystal: number;
  readonly egg: number;
  readonly key: number;
  readonly hits: number;
  readonly freeHitsLeft: number;
  readonly cleared: boolean;
  readonly timeLeftAtEnd: number;
  readonly isletsVisited: number;
  readonly cagesBroken: number;
  readonly cratesBroken: number;
  readonly ghostKeys: number;
}

// Counts across the whole run, for the milestones.
export interface Feats {
  readonly hoppedOver: number;
  readonly ducked: number;
  readonly crushed: number;
  readonly closeShave: boolean;
  readonly quickPair: boolean;
  readonly lastCrystalAt: number;
}

export interface RunState {
  readonly seed: number;
  readonly lead: number;
  readonly tick: number;
  readonly ended: boolean;
  readonly won: boolean;
  readonly round: number;
  readonly phase: RoundPhase;
  readonly phaseTick: number;
  readonly timeLeft: number;
  // The state of the seeded generator that times and aims the hazards.
  readonly hazardRng: number;
  // The hazards' own clock, in thirds of a tick: three a tick, or one while frost vision slows the world.
  readonly hazardClock: number;
  readonly nextSnowballAt: number;
  readonly nextDartAt: number;
  readonly spawned: number;
  readonly nextId: number;
  readonly player: Player;
  readonly pad: Pad;
  readonly pressed: number;
  readonly lastInputTick: number;
  readonly items: readonly Item[];
  readonly crates: readonly Breakable[];
  readonly cages: readonly Breakable[];
  readonly snowballs: readonly Snowball[];
  readonly darts: readonly Dart[];
  readonly bolts: readonly Bolt[];
  readonly tallies: readonly Tally[];
  readonly feats: Feats;
  readonly happenings: readonly Happening[];
  readonly happened: number;
  readonly score: number;
}

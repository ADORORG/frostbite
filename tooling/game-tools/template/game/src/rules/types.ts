// A run of the game, as the rules hold it. The place of the marker is known only as of `tick` (the tick of the last tap): where it is
// now is worked out from that, so the record needs to hold only the taps.
export interface StarterState {
  readonly cause: "missed" | "timeout" | null;
  // 1 while the marker moves up the lane, -1 while it moves back.
  readonly direction: 1 | -1;
  readonly ended: boolean;
  // The tick of the last tap (-1 before the first), which the next tap must come after.
  readonly lastTap: number;
  readonly position: number;
  // The generator's state, which gives each new zone.
  readonly rng: number;
  readonly score: number;
  readonly speed: number;
  readonly tick: number;
  // Where the middle of the zone is.
  readonly zone: number;
}

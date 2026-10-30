// A run in progress. Nothing in it is a clock or a random source: the whole slope is laid out from the seed when the run starts.
export interface SnowballState {
  // Ticks into the hop that is going on, or 0 when the snowball is on the snow.
  readonly air: number;
  readonly alive: boolean;
  // Rocks passed without being hit.
  readonly cleared: number;
  // Rocks passed with the snowball no more than `closeCallClearance` above them.
  readonly closeCalls: number;
  readonly distance: number;
  readonly ended: boolean;
  // The snowball reached the foot of the slope.
  readonly finished: boolean;
  readonly hops: number;
  // The lowest the snowball's underside was over the rock it is passing, or null before that rock is reached.
  readonly lowestClearance: number | null;
  // Where each rock starts, in units from the top, in order.
  readonly rocks: readonly number[];
  readonly tick: number;
}

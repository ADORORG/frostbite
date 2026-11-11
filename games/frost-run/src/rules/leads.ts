// The five heroes. Each plays by the same rules with a few numbers changed, and each can win: the fairness test plays a run with every
// one of them. The numbers are drafts for the owner, chosen so that no hero's edge settles a run on its own.
export const leadIds = ["volt", "nib", "lumen", "hrimm", "pip"] as const;
export type LeadId = (typeof leadIds)[number];

export interface Lead {
  readonly id: LeadId;
  // Body.
  readonly radius: number;
  readonly height: number;
  readonly duckHeight: number;
  // Movement, in millimetres a tick.
  readonly runSpeed: number;
  readonly hopSpeed: number;
  readonly rollSpeed: number;
  // How long the powers last, in ticks.
  readonly hoverTicks: number;
  readonly visionTicks: number;
  readonly growTicks: number;
  readonly boltLife: number;
  // What a hit does.
  readonly hitPenalty: number;
  readonly knockSpeed: number;
  readonly freeHitsPerRound: number;
  // Extra reach for collecting, in millimetres.
  readonly reachBonus: number;
  // Whether a roll bursts the big snowballs of the last round too.
  readonly rollBreaksBig: boolean;
}

const base = {
  boltLife: 44,
  duckHeight: 450,
  freeHitsPerRound: 0,
  growTicks: 240,
  height: 1000,
  hitPenalty: 300,
  hopSpeed: 126,
  hoverTicks: 110,
  knockSpeed: 230,
  radius: 420,
  reachBonus: 0,
  rollBreaksBig: false,
  rollSpeed: 180,
  runSpeed: 85,
  visionTicks: 210,
} as const;

export const leads: readonly Lead[] = [
  // The neon ram: quick on its hooves, and a roll is a charge that breaks anything in its way.
  {
    ...base,
    hopSpeed: 120,
    hoverTicks: 92,
    id: "volt",
    radius: 430,
    rollBreaksBig: true,
    rollSpeed: 215,
    runSpeed: 92,
  },
  // The baby dragon: wings, so it hovers far longer, and its frost breath reaches farther.
  {
    ...base,
    boltLife: 62,
    hopSpeed: 122,
    hoverTicks: 170,
    id: "nib",
    radius: 410,
    runSpeed: 84,
  },
  // The spirit miner: its lantern draws things in from farther, and it sees longer in frost vision.
  { ...base, height: 1050, id: "lumen", reachBonus: 260, visionTicks: 300 },
  // The ice giant: big and a little slow, but a hit costs it only three seconds and grow lasts longer.
  {
    ...base,
    duckHeight: 560,
    growTicks: 330,
    height: 1200,
    hitPenalty: 180,
    hopSpeed: 118,
    hoverTicks: 100,
    id: "hrimm",
    knockSpeed: 140,
    radius: 500,
    rollSpeed: 170,
    runSpeed: 79,
  },
  // The snow sprite: balanced, and its lucky scarf makes the first hit of each round free.
  { ...base, freeHitsPerRound: 1, id: "pip" },
];

// The lead a run is played with, by its place in the list.
export const leadAt = (index: number): Lead | undefined => leads[index];

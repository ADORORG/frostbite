import {
  ease,
  palette,
  rect,
  sceneHeight,
  sceneWidth,
  seededRandom,
  type Scene,
} from "../engine/index.ts";

// Road hopper: a frog crosses an endless road one lane at a time, through the gaps in the traffic. The road slides down as the frog hops,
// and four kinds of lane repeat. Each lane's cars are timed so the gap sits at the frog's column while the frog is in that lane, so it is
// never hit, and every car's speed carries it a whole number of gaps in four hops, so the loop closes.
const hopSeconds = 1.2;
const lanes = 4;
const laneHeight = 12;
const frogX = sceneWidth / 2;
const frogY = 70;
const carWidth = 14;
const carHeight = 6;
const spacing = 60;
const speeds = [12.5, 25, 12.5, 25] as const;
const settleShare = 0.3;
const hopLift = 3;
const loopSeconds = hopSeconds * lanes * 2;
const lanesAbove = 6;
const lanesBelow = 3;
const tints = [
  palette.turfAlt,
  palette.red,
  palette.cyan,
  palette.yellow,
] as const;
// Where a car's left edge is, in a gap, when the gap is centred on the frog.
const gapCentre = sceneWidth / 2 - (spacing - carWidth) / 2 - carWidth;

export const hopper: Scene = {
  id: "hopper",
  make: () => {
    const random = seededRandom(17);
    const tufts = Array.from({ length: 12 }, () =>
      Math.floor(random() * sceneWidth),
    );
    return {
      draw: (surface, t) => {
        rect(surface, 0, 0, sceneWidth, sceneHeight, palette.turf);
        const hop = Math.floor(t / hopSeconds);
        const share = t / hopSeconds - hop;
        const settle = ease(share / settleShare);
        // The lane the frog is crossing comes under it at the start of its hop, sliding the road down by one lane.
        for (let lane = hop + lanesAbove; lane >= hop - lanesBelow; lane -= 1) {
          const y =
            frogY -
            laneHeight / 2 +
            (hop - lane) * laneHeight -
            laneHeight * (1 - settle);
          const type = ((lane % lanes) + lanes) % lanes;
          rect(
            surface,
            0,
            y,
            sceneWidth,
            laneHeight,
            type === 0 ? palette.turfAlt : palette.road,
          );
          if (type === 0) {
            for (const x of tufts) rect(surface, x, y + 3, 2, 2, palette.green);
            continue;
          }
          rect(surface, 0, y + laneHeight - 1, sceneWidth, 1, palette.roadAlt);
          const direction = type % 2 === 0 ? 1 : -1;
          const speed = speeds[type] ?? 12.5;
          // The frog is in this lane for the last part of its hop; the gap is centred on the frog in the middle of that.
          const inLane =
            type * hopSeconds + ((settleShare + 1) / 2) * hopSeconds;
          const phase = gapCentre - direction * speed * inLane;
          const along =
            (((phase + direction * speed * t) % spacing) + spacing) % spacing;
          for (let k = -1; k * spacing < sceneWidth; k += 1) {
            rect(
              surface,
              along + k * spacing,
              y + 3,
              carWidth,
              carHeight,
              tints[type] ?? palette.red,
            );
            rect(
              surface,
              along + k * spacing + 3,
              y + 3,
              carWidth - 6,
              2,
              palette.shine,
            );
          }
        }
        const lift =
          Math.sin(Math.min(1, share / settleShare) * Math.PI) * hopLift;
        rect(surface, frogX - 3, frogY + 1 - lift, 6, 5, palette.green);
        rect(surface, frogX - 3, frogY - 1 - lift, 2, 2, palette.green);
        rect(surface, frogX + 1, frogY - 1 - lift, 2, 2, palette.green);
        rect(surface, frogX - 2, frogY - lift, 1, 1, palette.background);
        rect(surface, frogX + 2, frogY - lift, 1, 1, palette.background);
      },
      loopSeconds,
    };
  },
  name: "Road hopper",
};

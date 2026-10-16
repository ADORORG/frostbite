import { describe, expect, it } from "vitest";

import { devGameOf } from "../src/dev-games.ts";

const milestone = {
  claimPolicy: "once" as const,
  criteria: "Win.",
  description: "You won.",
  id: "first-win",
  title: "First win",
};
const games = [
  {
    capabilities: ["wallet"],
    id: "arcade",
    milestones: [
      { ...milestone, verification: "replay-verified" },
      {
        ...milestone,
        claimPolicy: "repeatable" as const,
        id: "streak",
        maxCount: 5,
      },
      { ...milestone, id: "ten", target: 10 },
    ],
  },
  { capabilities: [], id: "plain", milestones: [] },
];

describe("a registered game as the test page needs it", () => {
  it("is its id, what it asks for and its milestones, with only the fields the page reads", () => {
    expect(devGameOf(games, "arcade")).toEqual({
      capabilities: ["wallet"],
      id: "arcade",
      milestones: [
        milestone,
        { ...milestone, claimPolicy: "repeatable", id: "streak", maxCount: 5 },
        { ...milestone, id: "ten", target: 10 },
      ],
    });
  });

  it("has an empty list for a game with nothing", () => {
    expect(devGameOf(games, "plain")).toEqual({
      capabilities: [],
      id: "plain",
      milestones: [],
    });
  });

  it("names the games there are when asked for one that is not registered", () => {
    expect(() => devGameOf(games, "arcad")).toThrow(
      'No game "arcad" is registered. Registered: arcade, plain.',
    );
    expect(() => devGameOf([], "any")).toThrow("Registered: none.");
  });
});

import { describe, expect, it } from "vitest";

import {
  devConfigSchema,
  devGameSchema,
  hostedGameOf,
} from "../src/dev-host/config.ts";

const milestone = {
  claimPolicy: "once",
  criteria: "Win.",
  description: "You won.",
  id: "first-win",
  title: "First win",
};

describe("what a builder writes about their game for the test page", () => {
  it("is an id, the capabilities it asks for and its milestones, and both lists may be left out", () => {
    expect(devGameSchema.parse({ id: "my-game" })).toEqual({
      capabilities: [],
      id: "my-game",
      milestones: [],
    });
    expect(
      devGameSchema.parse({
        capabilities: ["wallet"],
        id: "my-game",
        milestones: [milestone],
      }).milestones,
    ).toEqual([milestone]);
  });

  it.each([
    ["no id", {}],
    ["an id that is not a slug", { id: "My Game" }],
    ["a field it does not have", { id: "my-game", rewards: {} }],
    [
      "a milestone with a field it does not have",
      { id: "my-game", milestones: [{ ...milestone, extra: 1 }] },
    ],
    [
      "a milestone with an unknown policy",
      { id: "my-game", milestones: [{ ...milestone, claimPolicy: "never" }] },
    ],
    ["capabilities that are not text", { capabilities: [1], id: "my-game" }],
  ])("refuses %s", (_name, value) => {
    expect(devGameSchema.safeParse(value).success).toBe(false);
  });

  it("is what the host is given, with nothing added", () => {
    expect(
      hostedGameOf(
        devGameSchema.parse({
          capabilities: ["wallet"],
          id: "my-game",
          milestones: [milestone],
        }),
      ),
    ).toEqual({
      capabilities: ["wallet"],
      id: "my-game",
      milestones: [milestone],
    });
  });

  it("is sent to the page with the address of the built game, and nothing else", () => {
    const game = devGameSchema.parse({ id: "my-game" });
    expect(
      devConfigSchema.safeParse({ game, src: "/play/my-game/index.html" })
        .success,
    ).toBe(true);
    expect(devConfigSchema.safeParse({ game, src: "" }).success).toBe(false);
    expect(
      devConfigSchema.safeParse({ game, src: "/x", extra: 1 }).success,
    ).toBe(false);
  });
});

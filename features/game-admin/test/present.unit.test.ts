import { gameAdminStepSchema } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { peopleOf, toWireStep } from "../src/application/present.ts";
import { adminGames } from "../src/game-info.ts";
import { administeredGameLookup } from "../src/runtime.ts";
import {
  config,
  contract,
  defineSummary,
  game,
  otherStaffId,
  plainGame,
  staffId,
  view,
} from "./support/fixtures.ts";

const names = new Map([[staffId, "Ada"]]);

describe("a step as the page is told of it", () => {
  it("is a valid wire step: the stage, the plain-text summary, the people by name, and the transaction while it is to be signed", () => {
    const wire = toWireStep(view(), names);
    expect(gameAdminStepSchema.parse(wire)).toEqual(wire);
    expect(wire).toMatchObject({
      createdBy: "Ada",
      state: "awaiting-signature",
      submittedBy: null,
      summary: {
        contractId: "rewards-1",
        fee: { asset: "sim", baseUnits: "1" },
        paused: true,
      },
      toSign: { format: "sim-json/1", payload: "{}" },
    });
    expect(wire.toSign).not.toHaveProperty("summary");
  });

  it("shows a definition's milestone, limit and drawing, and no transaction once it is signed", () => {
    const wire = toWireStep(
      view({
        milestoneId: "first-win",
        operation: "define-milestone",
        state: "broadcast_accepted",
        summary: defineSummary(),
        toSign: null,
      }),
      names,
    );
    expect(wire).toMatchObject({
      state: "pending",
      summary: {
        claimLimit: 1,
        drawing: { bytes: 6 },
        milestoneId: "first-win",
      },
      toSign: null,
    });
    expect(wire.summary).not.toHaveProperty("paused");
  });

  it("names a person whose account is gone as nobody, and a person it was not told of as nobody", () => {
    const wire = toWireStep(
      view({ createdBy: null, submittedBy: otherStaffId }),
      names,
    );
    expect(wire.createdBy).toBeNull();
    expect(wire.submittedBy).toBeNull();
  });

  it("refuses a summary that names no contract", () => {
    const nameless = { ...view().summary, contract: undefined };
    expect(() => toWireStep(view({ summary: nameless }), names)).toThrow(
      /contract/u,
    );
  });

  it("lists each person once, and none for an account that is gone", () => {
    expect(
      peopleOf([
        view(),
        view({ submittedBy: otherStaffId }),
        view({ createdBy: null }),
      ]).sort(),
    ).toEqual([otherStaffId, staffId].sort());
  });
});

describe("the games administration knows", () => {
  it("lists only games that declare rewards, with milestones, claim limits and the contract if there is one", () => {
    const [arcade, ...others] = adminGames([game, plainGame], config());
    expect(others).toEqual([]);
    expect(arcade).toMatchObject({
      contractId: "rewards-1",
      id: "arcade",
      maxDrawingBytes: 4096n,
      milestones: [
        { claimLimit: 1, id: "first-win", title: "First win" },
        { claimLimit: 3, id: "streak", title: "Streak" },
      ],
    });
    expect(adminGames([game], config(false))[0]?.contractId).toBeNull();
  });

  it("gives the service every game that declares rewards, with its contract if it has one", () => {
    const known = adminGames([game, plainGame], config());
    const lookup = administeredGameLookup(known, config());
    expect(lookup("arcade")).toMatchObject({
      contract,
      maxDrawingBytes: 4096n,
    });
    expect(lookup("arcade")?.milestones.get("streak")).toEqual({
      claimLimit: 3,
    });
    expect(lookup("plain")).toBeNull();
    const undeployed = config(false);
    expect(
      administeredGameLookup(
        adminGames([game], undeployed),
        undeployed,
      )("arcade"),
    ).toMatchObject({ contract: null });
  });

  it("refuses to start when a game has a contract but no drawing limit is configured for it", () => {
    const unlimited = {
      ...config(),
      maxDrawingBytes: new Map<string, bigint>(),
    };
    expect(() => adminGames([game], unlimited)).toThrow(/drawing limit/u);
    // Without a contract there is nothing to bound, so nothing is missing.
    expect(
      adminGames([game], { ...unlimited, contracts: new Map() })[0],
    ).toMatchObject({ contractId: null, maxDrawingBytes: null });
  });
});

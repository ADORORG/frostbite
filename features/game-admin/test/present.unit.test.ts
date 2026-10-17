import { gameAdminStepSchema } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { peopleOf, toWireStep } from "../src/application/present.ts";
import { adminGames } from "../src/game-info.ts";
import { administeredGameLookup } from "../src/runtime.ts";
import {
  chain,
  contract,
  defineSummary,
  deploySummary,
  publishSummary,
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

  it("refuses a step on a contract whose summary names no contract", () => {
    const nameless = { ...view().summary, contract: undefined };
    expect(() => toWireStep(view({ summary: nameless }), names)).toThrow(
      /contract/u,
    );
    expect(() =>
      toWireStep(
        view({
          operation: "define-milestone",
          summary: {
            ...defineSummary(),
            contract: undefined,
            milestone: undefined,
          },
        }),
        names,
      ),
    ).toThrow(/contract/u);
  });

  it("shows publishing a template by the template and where it goes, with no contract to name", () => {
    const wire = toWireStep(
      view({
        gameId: null,
        operation: "publish-template",
        summary: publishSummary(),
        templateRef: "game-rewards@1.0.0",
      }),
      names,
    );
    expect(gameAdminStepSchema.parse(wire)).toEqual(wire);
    expect(wire).toMatchObject({
      gameId: null,
      templateRef: "game-rewards@1.0.0",
      summary: { template: { address: "at-1", id: "game-rewards" } },
    });
    expect(wire.summary).not.toHaveProperty("contractId");
  });

  it("shows creating a game's contract by what it is made from and what it accepts, and what the network says it made", () => {
    const wire = toWireStep(
      view({
        createdContracts: ["2:7"],
        operation: "deploy",
        state: "confirmed",
        summary: deploySummary(),
        toSign: null,
      }),
      names,
    );
    expect(gameAdminStepSchema.parse(wire)).toEqual(wire);
    expect(wire).toMatchObject({
      createdContracts: ["2:7"],
      state: "confirmed",
      summary: {
        collectibleAddress: "at-2",
        maxDrawingBytes: 4096,
        template: { address: "at-1" },
      },
    });
  });

  it("shows a template without a known address as a template only", () => {
    const wire = toWireStep(
      view({
        gameId: null,
        operation: "publish-template",
        summary: publishSummary({ at: undefined }),
        templateRef: "game-rewards@1.0.0",
      }),
      names,
    );
    expect(wire.summary.template).toEqual({
      id: "game-rewards",
      version: "1.0.0",
    });
  });

  it("says whether the address of its contract can be entered, and by whom it was", () => {
    expect(toWireStep(view(), names)).toMatchObject({
      recordable: false,
      recordedBy: null,
    });
    expect(
      toWireStep(view({ recordable: true, recordedBy: staffId }), names),
    ).toMatchObject({ recordable: true, recordedBy: "Ada" });
  });

  it("lists each person once, and none for an account that is gone", () => {
    expect(
      peopleOf([
        view(),
        view({ createdBy: null }),
        view({ recordedBy: otherStaffId }),
      ]).sort(),
    ).toEqual([otherStaffId, staffId].sort());
  });
});

describe("the games administration knows", () => {
  it("lists only games that declare rewards, with milestones and claim limits", () => {
    const [arcade, ...others] = adminGames([game, plainGame]);
    expect(others).toEqual([]);
    expect(arcade).toEqual({
      chain,
      id: "arcade",
      milestones: [
        { claimLimit: 1, id: "first-win", title: "First win" },
        { claimLimit: 3, id: "streak", title: "Streak" },
      ],
      title: "Arcade",
    });
  });

  const store = (
    recorded: {
      address: string;
      family: string;
      maxDrawingBytes: number;
    } | null,
  ) => {
    const asked: [string, string][] = [];
    return {
      asked,
      gameContract: (gameId: string, onChain: string) => {
        asked.push([gameId, onChain]);
        return Promise.resolve(recorded);
      },
    };
  };

  it("gives the service every game that declares rewards, with the contract on record and the size it accepts", async () => {
    const contracts = store({
      address: "rewards-1",
      family: "simulated",
      maxDrawingBytes: 4096,
    });
    const lookup = administeredGameLookup(
      adminGames([game, plainGame]),
      contracts,
    );
    const arcade = await lookup("arcade");
    expect(arcade).toMatchObject({
      chain,
      contract,
      maxDrawingBytes: 4096n,
    });
    expect(arcade?.milestones.get("streak")).toEqual({ claimLimit: 3 });
    expect(contracts.asked).toEqual([["arcade", chain]]);
    expect(await lookup("plain")).toBeNull();
    expect(contracts.asked).toHaveLength(1);
  });

  it("gives a game with no contract on record none, and no drawing size to keep", async () => {
    const lookup = administeredGameLookup(adminGames([game]), store(null));
    expect(await lookup("arcade")).toMatchObject({
      contract: null,
      maxDrawingBytes: 0n,
    });
  });
});

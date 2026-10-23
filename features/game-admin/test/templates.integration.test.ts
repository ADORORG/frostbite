import { describe, expect, it } from "vitest";

import { gameId } from "./support/fixtures.ts";
import {
  createContract,
  creation,
  operations,
  publishing,
  registerHarness,
  runStep,
  seedStaff,
  sessionFor,
} from "./support/harness.ts";

registerHarness();

describe("publishing templates and creating a game's contract through the operations", () => {
  it("shows no template published at first, then each one where it was published, with the log of who did it", async () => {
    const ada = await seedStaff("Ada");
    const ops = operations();
    const empty = await ops.templates.execute({}, sessionFor(ada));
    expect(empty).toMatchObject({
      ok: true,
      value: {
        publishable: [
          { id: "game-rewards", version: "1.0.0" },
          { id: "milestone-collectible", version: "1.0.0" },
        ],
        published: [],
        steps: [],
      },
    });
    const done = await runStep(ops, ada, publishing("game-rewards"));
    expect(done).toMatchObject({
      createdBy: "Ada",
      gameId: null,
      operation: "publish-template",
      state: "complete",
      templateRef: "game-rewards@1.0.0",
    });
    expect(await ops.templates.execute({}, sessionFor(ada))).toMatchObject({
      value: {
        published: [
          { address: "template-1", templateRef: "game-rewards@1.0.0" },
        ],
        steps: [{ id: done.id, state: "complete" }],
      },
    });
  });

  it("makes a game's contract once both templates are published, and then shows it with the step that made it", async () => {
    const ada = await seedStaff("Ada");
    const ops = operations();
    const before = await ops.list.execute({ gameId }, sessionFor(ada));
    expect(before).toMatchObject({
      value: {
        contract: null,
        drawingCeiling: 8192,
        steps: [],
        templatesReady: false,
      },
    });
    const made = await createContract(ops, ada);
    expect(made).toMatchObject({
      gameId,
      operation: "deploy",
      state: "complete",
      summary: { maxDrawingBytes: 4096 },
    });
    expect(made.createdContracts).toHaveLength(1);
    const after = await ops.list.execute({ gameId }, sessionFor(ada));
    expect(after).toMatchObject({
      value: {
        contract: { address: made.createdContracts[0], maxDrawingBytes: 4096 },
        drawingCeiling: 8192,
        templatesReady: true,
      },
    });
  });

  it("answers why a step cannot be started, instead of failing", async () => {
    const ada = await seedStaff();
    const ops = operations();
    const refused = async (input: Parameters<typeof ops.start.execute>[0]) => {
      const answer = await ops.start.execute(input, sessionFor(ada));
      return answer.ok && answer.value.status === "refused"
        ? answer.value.reason
        : "started";
    };
    expect(await refused(creation())).toBe("template-not-published");
    expect(await refused(publishing("something-else"))).toBe(
      "unknown-template",
    );
    await runStep(ops, ada, publishing("game-rewards"));
    expect(await refused(publishing("game-rewards"))).toBe("already-published");
    await runStep(ops, ada, publishing("milestone-collectible"));
    expect(await refused(creation(1_000_000))).toBe("could-not-build");
    await runStep(ops, ada, creation());
    expect(await refused(creation())).toBe("already-created");
  });
});

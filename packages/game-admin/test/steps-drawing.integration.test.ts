import { afterEach, describe, expect, it } from "vitest";

import { drawingNotHeld } from "../src/held-drawing.ts";
import {
  chain,
  defineInput,
  heldDrawing,
  network,
  registerDatabase,
  seedStaff,
  service,
  startAndSign,
} from "./support/fixture.ts";

registerDatabase();
afterEach(() => {
  heldDrawing.mode = "chain";
});

// Sends a definition and lets the network confirm it, up to the point where the platform would complete it.
async function confirmed(input: ReturnType<typeof defineInput>) {
  const { signed, step } = await startAndSign(input);
  await service.submitSigned({
    signed,
    staffId: input.staffId,
    stepId: step.id,
  });
  network.controls.advance(chain, 3);
  await service.refresh(step.id);
  return step.id;
}
const withoutDrawing = (staffId: string) =>
  defineInput(staffId, {
    action: { milestoneId: "first-win", operation: "define-milestone" },
  });

describe("a definition is complete when the contract holds the drawing that was signed", () => {
  it("completes when it does", async () => {
    const id = await confirmed(defineInput(await seedStaff()));
    expect(await service.refresh(id)).toMatchObject({
      ok: true,
      step: { state: "complete" },
    });
  });

  it.each(["none", "different"] as const)(
    "fails, saying so, when the contract holds %s",
    async (mode) => {
      const id = await confirmed(defineInput(await seedStaff()));
      heldDrawing.mode = mode;
      const failed = await service.refresh(id);
      expect(failed).toMatchObject({
        ok: true,
        step: { failureReason: drawingNotHeld, state: "indexed_failure" },
      });
      // Looking again does not turn it into a success.
      expect(await service.refresh(id)).toMatchObject({
        step: { state: "indexed_failure" },
      });
    },
  );

  it("is looked at again later, not decided, when the chain cannot be asked", async () => {
    const id = await confirmed(defineInput(await seedStaff()));
    heldDrawing.mode = "down";
    expect(await service.refresh(id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    heldDrawing.mode = "chain";
    expect(await service.refresh(id)).toMatchObject({
      step: { state: "complete" },
    });
  });

  it("has nothing to compare for a definition made without a drawing", async () => {
    heldDrawing.mode = "none";
    const id = await confirmed(withoutDrawing(await seedStaff()));
    expect(await service.refresh(id)).toMatchObject({
      step: { state: "complete" },
    });
  });
});

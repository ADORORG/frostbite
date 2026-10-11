import { describe, expect, it } from "vitest";

import {
  firstOpenStep,
  isStepFilled,
  stepFromHash,
  stepLabels,
  wizardSteps,
} from "../../src/client/progress.ts";
import { detail, itemRecord } from "../support/detail.ts";
import { id } from "../support/stubs.ts";

describe("wizard progress", () => {
  it("asks for a description, a cover image, and at least one item; supply is always filled", () => {
    const empty = detail();
    expect(wizardSteps.map((step) => isStepFilled(empty, step))).toEqual([
      false,
      true,
      false,
      false,
      false,
    ]);
    const filled = detail({ coverAssetId: id(), description: "About" }, [
      itemRecord(1),
    ]);
    expect(wizardSteps.map((step) => isStepFilled(filled, step))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it("treats a description of only spaces as missing", () => {
    expect(isStepFilled(detail({ description: "   " }), "details")).toBe(false);
  });

  it("lands a returning creator on the first step that still asks for something", () => {
    expect(firstOpenStep(detail())).toBe("details");
    expect(firstOpenStep(detail({ description: "About" }))).toBe("images");
    expect(
      firstOpenStep(detail({ coverAssetId: id(), description: "About" })),
    ).toBe("items");
    expect(
      firstOpenStep(
        detail({ coverAssetId: id(), description: "About" }, [itemRecord(1)]),
      ),
    ).toBe("review");
  });

  it("reads a step from a URL hash and ignores anything else", () => {
    expect(stepFromHash("#items")).toBe("items");
    expect(stepFromHash("supply")).toBe("supply");
    expect(stepFromHash("#nonsense")).toBeNull();
    expect(stepFromHash("")).toBeNull();
  });

  it("has a label for every step", () => {
    expect(Object.keys(stepLabels).sort()).toEqual([...wizardSteps].sort());
  });
});

import { describe, expect, it } from "vitest";

import { isDefined, latestDefinition } from "../src/domain/definitions.ts";
import { defining, step } from "./support/fake-api.ts";

describe("where a milestone's definition stands in the log", () => {
  const failed = defining({
    id: "11111111-1111-4111-8111-111111111111",
    state: "failed",
  });
  const complete = defining({
    id: "22222222-2222-4222-8222-222222222222",
    state: "complete",
  });

  it("is the last step that set out to define it, whatever became of it", () => {
    expect(latestDefinition([failed, complete], "first-win")).toBe(complete);
    expect(latestDefinition([complete, failed], "first-win")).toBe(failed);
  });

  it("is none for a milestone never tried, and ignores steps that define other milestones or do other things", () => {
    expect(latestDefinition([], "first-win")).toBeUndefined();
    expect(latestDefinition([complete], "streak")).toBeUndefined();
    expect(
      latestDefinition([step({ operation: "set-claims-paused" })], "first-win"),
    ).toBeUndefined();
  });

  it("counts a milestone as defined only when its last definition completed", () => {
    expect(isDefined([complete], "first-win")).toBe(true);
    expect(isDefined([failed], "first-win")).toBe(false);
    expect(isDefined([complete, failed], "first-win")).toBe(false);
    expect(isDefined([], "first-win")).toBe(false);
  });
});

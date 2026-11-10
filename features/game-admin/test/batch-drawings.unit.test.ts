import { sanitizeDrawing } from "@frostbite/milestone-art";
import { describe, expect, it } from "vitest";

import {
  milestoneIdOfFile,
  planBatch,
  type DrawingFile,
} from "../src/domain/batch-drawings.ts";
import { drawingLimits } from "./support/fixtures.ts";

const good =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#ff0000"/></svg>';
// Accessibility hints are not on the allow-list, so a drawing exported with them is refused.
const withRole =
  '<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#ff0000"/></svg>';
const policy = { ...drawingLimits, maxBytes: 4096 };
const milestones = [
  { claimLimit: 1, id: "first-win", title: "First win" },
  { claimLimit: 3, id: "streak", title: "Streak" },
  { claimLimit: 1, id: "flawless", title: "Flawless" },
];
const plan = (
  files: readonly DrawingFile[],
  defined: readonly string[] = [],
  over = policy,
) => planBatch({ defined: new Set(defined), files, milestones, policy: over });
const file = (name: string, text = good): DrawingFile => ({ name, text });
const states = (rows: ReturnType<typeof plan>["rows"]) =>
  rows.map(({ milestoneId, state }) => [milestoneId, state]);

describe("the milestone a file draws", () => {
  it("is named by the file, without its svg extension in any case", () => {
    expect(milestoneIdOfFile("first-win.svg")).toBe("first-win");
    expect(milestoneIdOfFile("first-win.SVG")).toBe("first-win");
    expect(milestoneIdOfFile("first-win")).toBe("first-win");
    expect(milestoneIdOfFile("first-win.svg.png")).toBe("first-win.svg.png");
  });
});

describe("planning a batch of drawings", () => {
  it("gives a row to each milestone in the manifest's order, ready where its drawing passed and missing where there is none", () => {
    const { rows, unmatched } = plan([
      file("streak.svg"),
      file("first-win.svg"),
    ]);
    expect(states(rows)).toEqual([
      ["first-win", "ready"],
      ["streak", "ready"],
      ["flawless", "missing"],
    ]);
    expect(rows[0]).toMatchObject({ drawing: good, title: "First win" });
    expect(unmatched).toEqual([]);
  });

  it("names the files that match no milestone, and does not guess", () => {
    const { rows, unmatched } = plan([
      file("first-win.svg"),
      file("frist-win.svg"),
      file("notes.txt"),
    ]);
    expect(unmatched).toEqual(["frist-win.svg", "notes.txt"]);
    expect(states(rows)[0]).toEqual(["first-win", "ready"]);
  });

  it("leaves a milestone the contract already has alone, whatever file was chosen for it", () => {
    const { rows } = plan([file("first-win.svg", withRole)], ["first-win"]);
    expect(states(rows)[0]).toEqual(["first-win", "defined"]);
  });

  it("refuses a drawing the platform would refuse, with the reason it gives", () => {
    const { rows } = plan([file("streak.svg", withRole)]);
    const refusal = sanitizeDrawing(withRole, policy);
    if (refusal.ok) throw new Error("the sample should be refused");
    expect(rows[1]).toMatchObject({ detail: refusal.detail, state: "refused" });
  });

  it("refuses a drawing over the contract's size, which is checked against this contract and no other", () => {
    expect(
      states(
        plan([file("streak.svg")], [], { ...policy, maxBytes: 20 }).rows,
      )[1],
    ).toEqual(["streak", "refused"]);
    expect(states(plan([file("streak.svg")], [], policy).rows)[1]).toEqual([
      "streak",
      "ready",
    ]);
  });

  it("refuses two files named for one milestone, rather than choosing between them", () => {
    const { rows } = plan([file("streak.svg"), file("streak.SVG")]);
    expect(rows[1]).toMatchObject({
      detail: "2 files are named for it.",
      state: "refused",
    });
  });

  it("plans nothing for an empty choice", () => {
    expect(states(plan([]).rows)).toEqual([
      ["first-win", "missing"],
      ["streak", "missing"],
      ["flawless", "missing"],
    ]);
  });
});

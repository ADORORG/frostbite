import { describe, expect, it, vi } from "vitest";

import { drawSections } from "../src/application/draw-sections.ts";

describe("drawing the landing page's parts", () => {
  it("keeps the order it is given and draws asynchronous parts too", async () => {
    const drawn = await drawSections([
      { id: "one", order: 1, render: () => "first" },
      { id: "two", order: 2, render: async () => "second" },
    ]);
    expect(drawn).toEqual([
      { id: "one", node: "first" },
      { id: "two", node: "second" },
    ]);
  });

  it("leaves out a part that fails and says which, without taking the others down", async () => {
    const report = vi.fn();
    const drawn = await drawSections(
      [
        { id: "good", order: 1, render: () => "fine" },
        {
          id: "bad",
          order: 2,
          render: async () => {
            throw new Error("the database is away");
          },
        },
        {
          id: "throws",
          order: 3,
          render: () => {
            throw new Error("sync");
          },
        },
      ],
      report,
    );
    expect(drawn).toEqual([{ id: "good", node: "fine" }]);
    const lines = report.mock.calls.map(([line]) => JSON.parse(String(line)));
    // Parts are drawn side by side, so the order they fail in is not fixed.
    expect(lines).toHaveLength(2);
    expect(lines).toEqual(
      expect.arrayContaining([
        { event: "home.section_failed", sectionId: "bad" },
        { event: "home.section_failed", sectionId: "throws" },
      ]),
    );
    expect(String(report.mock.calls)).not.toContain("database");
  });

  it("reports to the server's error log unless told where else to, as a line the operator can search", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await drawSections([
      {
        id: "broken",
        order: 1,
        render: () => {
          throw new Error("nope");
        },
      },
    ]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      event: "home.section_failed",
      sectionId: "broken",
    });
    log.mockRestore();
  });

  it("draws nothing when there is nothing to draw", async () => {
    expect(await drawSections([])).toEqual([]);
  });
});

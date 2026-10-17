import { mount, textOf } from "@ador/test-kit/dom";
import { describe, expect, it } from "vitest";

import { IndexingLamp } from "../src/ui/indexing-lamp.tsx";

const ok = (health: "catching-up" | "current" | "delayed", lag: number) =>
  ({
    chain: "Bitcoin signet",
    health,
    indexedHeight: 100,
    lag,
    observedAt: "2026-10-17T12:00:00.000Z",
    state: "ok",
    tipHeight: 100 + lag,
  }) as const;

describe("the indexing lamp", () => {
  it.each([
    [ok("current", 0), "Chain in sync", "status-lamp--ready"],
    [ok("catching-up", 2), "2 blocks behind", "status-lamp--ready"],
    [ok("delayed", 9), "Delayed, 9 blocks behind", "status-lamp--attention"],
    [
      { chain: "Bitcoin signet", state: "unavailable" } as const,
      "Chain status unknown",
      "status-lamp--neutral",
    ],
    [null, "Chain status unknown", "status-lamp--neutral"],
  ] as const)("shows %j as %s", async (indexing, label, tone) => {
    const container = await mount(<IndexingLamp indexing={indexing} />);
    const lamp = container.querySelector('[role="status"]');
    expect(lamp?.className).toContain(tone);
    expect(lamp?.textContent).toContain(label);
    expect(lamp?.getAttribute("data-compact")).toBe("true");
    // The detail is there for a reader of the page, not only for a pointer.
    expect(lamp?.querySelector(".status-lamp__detail")?.textContent).not.toBe(
      "",
    );
  });

  it("draws nothing where the platform follows no chain", async () => {
    const container = await mount(
      <IndexingLamp indexing={{ state: "none" }} />,
    );
    expect(textOf(container)).toBe("");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

import { click, mount, textOf } from "@ador/test-kit/dom";
import type { FeeSpeed } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { FeeSpeedChip } from "../src/ui/fee-speed-chip.tsx";
import type { FeeMarket } from "../src/ui/use-fee-quotes.ts";
import { answered, distorted, ok } from "./support/fee-fixtures.ts";

const chip = (market: FeeMarket, value: FeeSpeed = "fast") => (
  <FeeSpeedChip market={market} onChange={() => undefined} value={value} />
);
const trigger = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("button.fee-chip");

describe("the fee speed chip", () => {
  it("names the chosen speed with its rate and wait", async () => {
    const container = await mount(chip(answered(ok)));
    expect(trigger(container)?.textContent).toContain("Fast");
    expect(trigger(container)?.textContent).toContain("5.00 sat/vB");
    expect(trigger(container)?.getAttribute("aria-label")).toContain(
      "Fast, 5.00 sat/vB",
    );
    expect(trigger(container)?.dataset.off).toBeUndefined();
  });

  it("says a speed the chain prices beyond any step cannot be sent now", async () => {
    const container = await mount(chip(answered(distorted), "lightning"));
    expect(trigger(container)?.dataset.off).toBe("true");
    expect(trigger(container)?.getAttribute("aria-label")).toContain(
      "cannot be sent now",
    );
  });

  it("names only the speed where there is no quote for it, and opens the picker", async () => {
    const container = await mount(chip({ status: "unreachable" }));
    expect(trigger(container)?.textContent).toBe("FeeFast");
    await click(trigger(container));
    expect(textOf(container)).toContain("could not be asked what a fee costs");
  });

  it("chooses a speed from the opened picker and closes it", async () => {
    const chosen: FeeSpeed[] = [];
    const container = await mount(
      <FeeSpeedChip
        market={answered(ok)}
        onChange={(speed) => chosen.push(speed)}
        value="slow"
      />,
    );
    await click(trigger(container));
    await click(
      container.querySelector<HTMLInputElement>("input[value=medium]"),
    );
    expect(chosen).toEqual(["medium"]);
    expect(container.querySelector(".popover__panel")).toBeNull();
  });

  it("hands the platform's limit and the transaction's size to the picker, which prices each speed with them", async () => {
    const container = await mount(
      <FeeSpeedChip
        market={answered(ok)}
        maxFeeSats={100}
        onChange={() => undefined}
        value="fast"
        vbytes={200}
      />,
    );
    await click(trigger(container));
    expect(textOf(container)).toContain(
      "More than the 100 sats this step may pay",
    );
  });
});

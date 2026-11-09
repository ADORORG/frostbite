import {
  click,
  fieldByLabel,
  settle,
  textOf,
  typeInto,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { milestoneCopy } from "../src/domain/copy.ts";
import { byName } from "./support/find.ts";
import { defining, fakeApi, listing } from "./support/fake-api.ts";
import { panel, enterWallet } from "./support/panel.tsx";

const disabled = (container: HTMLElement, name: string) =>
  (byName(container, name) as HTMLButtonElement | null)?.disabled;

describe("defining a milestone with or without a drawing", () => {
  it("offers one way at a time: with a drawing once there is one, without when the field is empty", async () => {
    const start = vi.fn(async () => ({
      resumed: false,
      status: "started" as const,
      step: defining(),
    }));
    const container = await panel(fakeApi({ start }));
    await enterWallet(container);
    const field = () => fieldByLabel(container, "Drawing for Streak");

    // Nothing typed: only the explicit choice to define without a drawing is open, and the field says what that means.
    expect(field().isConnected).toBe(true);
    expect(disabled(container, "Define Streak")).toBe(true);
    expect(disabled(container, "Define Streak without a drawing")).toBe(false);
    expect(textOf(container)).toContain(milestoneCopy.defineWithoutHint);

    await typeInto(field(), "<svg/>");
    expect(disabled(container, "Define Streak")).toBe(false);
    expect(disabled(container, "Define Streak without a drawing")).toBe(true);

    await click(byName(container, "Define Streak"));
    expect(start).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: {
          drawing: "<svg/>",
          milestoneId: "streak",
          operation: "define-milestone",
        },
      }),
    );
  });

  it("does not start a definition from a drawing that is only spaces", async () => {
    const start = vi.fn();
    const container = await panel(fakeApi({ start }));
    await enterWallet(container);
    await typeInto(fieldByLabel(container, "Drawing for Streak"), "   ");
    expect(disabled(container, "Define Streak")).toBe(true);
    // Pressing it anyway starts nothing.
    await click(byName(container, "Define Streak"));
    expect(start).not.toHaveBeenCalled();
  });

  it("says, for each defined milestone, whether it was defined with a drawing", async () => {
    const withDrawing = defining({
      id: "33333333-3333-4333-8333-333333333333",
      state: "complete",
      toSign: null,
    });
    const without = defining({
      id: "44444444-4444-4444-8444-444444444444",
      state: "complete",
      toSign: null,
      summary: {
        ...defining().summary,
        drawing: undefined,
        milestoneId: "streak",
      },
    });
    const container = await panel(
      fakeApi({ list: vi.fn(async () => listing([withDrawing, without])) }),
    );
    await settle(() =>
      expect(
        container.querySelector('[data-milestone="first-win"]')?.textContent,
      ).toContain("Defined"),
    );
    expect(
      container.querySelector('[data-milestone="first-win"]')?.textContent,
    ).toContain(milestoneCopy.drawn(6));
    expect(
      container.querySelector('[data-milestone="streak"]')?.textContent,
    ).toContain(milestoneCopy.undrawn);
  });
});

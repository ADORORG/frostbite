import {
  button,
  click,
  fieldByLabel,
  mount,
  settle,
  textOf,
  typeInto,
} from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { PlatformFeePanel } from "../src/ui/platform-fee-panel.tsx";
import { apiError, fakeApi } from "./support/fake-api.ts";

// A button the page must have, or the test says it does not.
const save = (container: HTMLElement) => {
  const found = button(container, "Save fee and address");
  if (found === null) throw new Error("the save button is missing");
  return found;
};

const chain = "simnet:one";
const treasury = "sim:one:7ea5a1ab";
const staffChain = (over: object = {}) => ({
  chain,
  current: {
    changedAt: "2026-10-16T12:00:00.000Z",
    changedBy: "Ada",
    feeUnits: "1500",
    treasury,
  },
  history: [
    {
      changedAt: "2026-10-16T11:00:00.000Z",
      changedBy: null,
      feeUnits: "0",
      treasury,
    },
  ],
  maximumFeeUnits: "100000",
  ...over,
});
const withChains = (...chains: object[]) =>
  fakeApi({ platformFee: vi.fn(async () => ({ chains }) as never) });

describe("the platform fee panel", () => {
  it("says what is charged and where it goes, who set it and when, and keeps the earlier settings behind a disclosure", async () => {
    const container = await mount(
      <PlatformFeePanel api={withChains(staffChain())} />,
    );
    await settle(() => expect(textOf(container)).toContain("1,500 sats"));
    expect(textOf(container)).toContain("Set 2026-10-16 12:00 by Ada");
    const earlier = container.querySelector("details");
    expect(earlier?.textContent).toContain("Earlier settings (1)");
    expect(earlier?.textContent).toContain(
      "set by an account that no longer exists",
    );
  });

  it("puts the fee and the treasury address side by side, both filled with what is in force", async () => {
    const container = await mount(
      <PlatformFeePanel api={withChains(staffChain())} />,
    );
    await settle(() => expect(textOf(container)).toContain("1,500 sats"));
    const fee = fieldByLabel(container, "Fee per claim (sats)");
    const address = fieldByLabel(container, "Treasury address");
    expect(fee.closest(".fee-fields")).not.toBeNull();
    expect(fee.closest(".fee-fields")).toBe(address.closest(".fee-fields"));
    expect((fee as HTMLInputElement).value).toBe("1500");
    expect((address as HTMLInputElement).value).toBe(treasury);
  });

  it("says no fee is set, and offers the form, before the first one", async () => {
    const container = await mount(
      <PlatformFeePanel
        api={withChains(staffChain({ current: null, history: [] }))}
      />,
    );
    await settle(() => expect(textOf(container)).toContain("No fee is set."));
    expect(container.querySelector("details")).toBeNull();
    expect(save(container).disabled).toBe(true);
  });

  it("saves the fee and the address together, then shows what the platform now holds", async () => {
    let held = staffChain();
    const api = fakeApi({
      platformFee: vi.fn(async () => ({ chains: [held] }) as never),
      setPlatformFee: vi.fn(async (input) => {
        held = staffChain({
          current: {
            changedAt: "2026-10-16T13:00:00.000Z",
            changedBy: "Ada",
            feeUnits: input.feeUnits,
            treasury: input.treasury,
          },
        });
        return {
          setting: {
            changedAt: "2026-10-16T13:00:00.000Z",
            changedBy: "Ada",
            feeUnits: input.feeUnits,
            treasury: input.treasury,
          },
          status: "saved" as const,
        };
      }),
    });
    const container = await mount(<PlatformFeePanel api={api} />);
    await settle(() => expect(textOf(container)).toContain("1,500 sats"));
    await typeInto(fieldByLabel(container, "Fee per claim (sats)"), "2500");
    await click(save(container));
    await settle(() =>
      expect(textOf(container)).toContain("Each claim now carries 2,500 sats"),
    );
    expect(api.setPlatformFee).toHaveBeenCalledWith({
      chain,
      feeUnits: "2500",
      treasury,
    });
    expect(api.platformFee).toHaveBeenCalledTimes(2);
  });

  it("says in words why a fee was refused, and nothing is shown as saved", async () => {
    const api = fakeApi({
      platformFee: vi.fn(async () => ({ chains: [staffChain()] }) as never),
      setPlatformFee: vi.fn(async () => ({
        limitUnits: "294",
        reason: "below-minimum-output" as const,
        status: "refused" as const,
      })),
    });
    const container = await mount(<PlatformFeePanel api={api} />);
    await settle(() => expect(textOf(container)).toContain("1,500 sats"));
    await typeInto(fieldByLabel(container, "Fee per claim (sats)"), "100");
    await click(save(container));
    await settle(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "Use at least 294 sats, or 0 for no fee. Nothing was changed.",
      ),
    );
    expect(textOf(container)).not.toContain("Saved.");
  });

  it("does not offer a fee that is not whole digits, nor a save with nothing changed", async () => {
    const container = await mount(
      <PlatformFeePanel api={withChains(staffChain())} />,
    );
    await settle(() => expect(textOf(container)).toContain("1,500 sats"));
    expect(save(container).disabled).toBe(true);
    await typeInto(fieldByLabel(container, "Fee per claim (sats)"), "1.5");
    expect(save(container).disabled).toBe(true);
    expect(textOf(container)).toContain("Whole satoshis");
    await typeInto(fieldByLabel(container, "Fee per claim (sats)"), "0");
    expect(save(container).disabled).toBe(false);
  });

  it("says it does not know whether a setting was kept when the platform does not answer, and tells staff to look", async () => {
    const api = fakeApi({
      platformFee: vi.fn(async () => ({ chains: [staffChain()] }) as never),
      setPlatformFee: vi.fn(async () => {
        throw apiError("network");
      }),
    });
    const container = await mount(<PlatformFeePanel api={api} />);
    await settle(() => expect(textOf(container)).toContain("1,500 sats"));
    await typeInto(fieldByLabel(container, "Fee per claim (sats)"), "0");
    await click(save(container));
    await settle(() =>
      expect(textOf(container)).toContain("nothing is known to have changed"),
    );
  });

  it("tells staff when the fee could not be loaded, rather than showing a form for a fee it does not know", async () => {
    const api = fakeApi({
      platformFee: vi.fn(async () => {
        throw apiError("network");
      }),
    });
    const container = await mount(<PlatformFeePanel api={api} />);
    await settle(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        "could not be loaded",
      ),
    );
    expect(container.querySelector("form")).toBeNull();
  });
});

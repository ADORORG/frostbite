import { feeSpeedQuestion } from "../src/domain/fee-copy.ts";
import type { FeeSpeed } from "@frostbite/shared/chain";
import { click, mount, settle, textOf } from "@frostbite/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import type { ChainStatusApi } from "../src/client/api.ts";
import { FeeSpeedPicker } from "../src/ui/fee-speed-picker.tsx";
import { useFeeQuotes } from "../src/ui/use-fee-quotes.ts";
import { answered, distorted, ok } from "./support/fee-fixtures.ts";

describe("the fee speed picker", () => {
  const picker = (
    props: Partial<Parameters<typeof FeeSpeedPicker>[0]> = {},
  ) => (
    <FeeSpeedPicker
      market={answered(ok)}
      onChange={() => undefined}
      value="slow"
      {...props}
    />
  );
  const options = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLInputElement>("input[type=radio]"),
  ];

  it("says the quotes are the last good ones when the platform could not renew them", async () => {
    const stale = await mount(picker({ market: answered(ok, true) }));
    expect(textOf(stale)).toContain(
      "Last read 12:00:00 UTC; the platform could not renew it just now.",
    );
    const current = await mount(picker());
    expect(textOf(current)).not.toContain("could not renew");
  });

  it("tells the rates without a block when the tip could not be read, and still offers every speed", async () => {
    const withoutTip = { ...ok, tipHeight: undefined };
    const container = await mount(picker({ market: answered(withoutTip) }));
    expect(options(container)).toHaveLength(4);
    expect(textOf(container)).toContain("Rates are the chain's quotes and");
    expect(textOf(container)).not.toContain(" at block ");
  });

  it("offers the four speeds in order, each with its wait and rate, and the chosen one checked", async () => {
    const container = await mount(picker({ value: "fast" }));
    expect(options(container).map((input) => input.value)).toEqual([
      "slow",
      "medium",
      "fast",
      "lightning",
    ]);
    expect(options(container).map((input) => input.checked)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect(textOf(container)).toContain("about 15 min");
    expect(textOf(container)).toContain("9.00 sat/vB");
    expect(textOf(container)).toContain("block 157,401");
    expect(container.querySelector("legend")?.textContent).toBe(
      feeSpeedQuestion,
    );
  });

  it("reports the speed chosen", async () => {
    const onChange = vi.fn<(speed: FeeSpeed) => void>();
    const container = await mount(picker({ onChange }));
    await click(options(container)[3] ?? null);
    expect(onChange).toHaveBeenCalledWith("lightning");
  });

  it("tells what each speed would cost for a transaction of a given size, and refuses a speed above the ceiling with the reason", async () => {
    const container = await mount(picker({ maxFeeSats: 1_000, vbytes: 200 }));
    expect(textOf(container)).toContain("≈ 202 sats");
    expect(textOf(container)).toContain("≈ 1,800 sats");
    expect(options(container).map((input) => input.disabled)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(textOf(container)).toContain(
      "More than the 1,000 sats this step may pay, so it cannot be chosen.",
    );
  });

  it("does not offer a speed the chain prices beyond any step, says why, and keeps the cheap one", async () => {
    const onChange = vi.fn<(speed: FeeSpeed) => void>();
    const container = await mount(
      picker({ market: answered(distorted), onChange }),
    );
    expect(options(container).map((input) => input.disabled)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(textOf(container)).toContain(
      "The chain is quoting more for this speed than the 500,000 sats a step may pay, even a small one, so it cannot be chosen now.",
    );
    await click(options(container)[1] ?? null);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("gives only one reason for a speed that is both priced out and too large for the step", async () => {
    const container = await mount(
      picker({
        market: answered(distorted),
        maxFeeSats: 1_000,
        vbytes: 200,
      }),
    );
    expect(options(container).map((input) => input.disabled)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(textOf(container)).toContain("more for this speed than the 500,000");
    expect(textOf(container)).not.toContain("More than the 1,000 sats");
  });

  it("warns when the speed already chosen has become one no step can afford", async () => {
    const container = await mount(
      picker({ market: answered(distorted), value: "lightning" }),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Lightning cannot be sent now. Choose another speed.",
    );
  });

  it("is switched off as a whole when asked", async () => {
    const container = await mount(picker({ disabled: true }));
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
  });

  it("says plainly that there is nothing to choose, and that the usual speed is used, when the market is unknown", async () => {
    for (const [market, expected] of [
      [{ status: "loading" } as const, "Loading what each speed costs"],
      [
        { status: "unreachable" } as const,
        "could not be asked what a fee costs",
      ],
      [
        answered({ chain: "Bitcoin testnet4", state: "unavailable" }),
        "Bitcoin testnet4 could not be asked",
      ],
      [answered({ state: "none" }), "No chain is configured"],
    ] as const) {
      const container = await mount(picker({ market }));
      expect(textOf(container)).toContain(expected);
      expect(options(container)).toHaveLength(0);
    }
  });
});

describe("asking for the fee market", () => {
  const clock = { at: Date.parse(ok.observedAt) };
  function Reading({ api }: { readonly api: ChainStatusApi }) {
    const market = useFeeQuotes({
      api,
      now: () => clock.at,
      polling: { forgetAfterMs: 400, refreshMs: 20 },
    });
    return (
      <p>
        {market.status === "answered"
          ? `answered ${market.fees.state}${market.stale ? " stale" : ""}`
          : market.status}
      </p>
    );
  }
  const apiWith = (fees: ChainStatusApi["fees"]): ChainStatusApi => ({
    fees,
    indexing: () => Promise.reject(new Error("not used")),
  });

  it("is loading, then the platform's answer", async () => {
    const container = await mount(
      <Reading api={apiWith(async () => ({ state: "none" }))} />,
    );
    await settle(() => expect(textOf(container)).toBe("answered none"));
  });

  it("says the platform is unreachable when the ask fails, rather than showing an old or invented market", async () => {
    const container = await mount(
      <Reading api={apiWith(() => Promise.reject(new Error("offline")))} />,
    );
    await settle(() => expect(textOf(container)).toBe("unreachable"));
  });

  it("keeps the last good market when a later ask fails, as stale once it is old, and says it does not know once it is too old", async () => {
    clock.at = Date.parse(ok.observedAt);
    const fees = vi
      .fn<ChainStatusApi["fees"]>()
      .mockResolvedValueOnce(ok)
      .mockRejectedValue(new Error("offline"));
    const container = await mount(<Reading api={apiWith(fees)} />);
    await settle(() => expect(textOf(container)).toBe("answered ok"));
    await settle(() => expect(fees.mock.calls.length).toBeGreaterThan(1));
    expect(textOf(container)).toBe("answered ok");
    clock.at += 40;
    await settle(() => expect(textOf(container)).toBe("answered ok stale"));
    clock.at += 400;
    await settle(() => expect(textOf(container)).toBe("unreachable"));
  });

  it("does not call an answer old that names no time", async () => {
    clock.at = Date.parse(ok.observedAt) + 10_000_000;
    const fees = vi
      .fn<ChainStatusApi["fees"]>()
      .mockResolvedValueOnce({ chain: "Bitcoin signet", state: "unavailable" })
      .mockRejectedValue(new Error("offline"));
    const container = await mount(<Reading api={apiWith(fees)} />);
    await settle(() => expect(fees.mock.calls.length).toBeGreaterThan(1));
    expect(textOf(container)).toBe("answered unavailable");
  });
});

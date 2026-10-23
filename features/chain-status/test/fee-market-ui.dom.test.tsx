import type { ChainFees, FeeSpeed } from "@ador/shared/chain";
import { click, mount, settle, textOf } from "@ador/test-kit/dom";
import { describe, expect, it, vi } from "vitest";

import { ChainStatusPanel } from "../src/ui/chain-status-panel.tsx";
import type { ChainStatusApi } from "../src/client/api.ts";
import { FeeSpeedPicker } from "../src/ui/fee-speed-picker.tsx";
import { useFeeQuotes } from "../src/ui/use-fee-quotes.ts";
import type { FeeMarket } from "../src/ui/use-fee-quotes.ts";

const ok: Extract<ChainFees, { state: "ok" }> = {
  chain: "Bitcoin testnet4",
  observedAt: "2026-10-23T12:00:00.000Z",
  quotes: [
    { approxMinutes: 250, satPerVb: 1.009, speed: "slow", targetBlocks: 25 },
    { approxMinutes: 60, satPerVb: 3, speed: "medium", targetBlocks: 6 },
    { approxMinutes: 30, satPerVb: 5, speed: "fast", targetBlocks: 3 },
    { approxMinutes: 15, satPerVb: 9, speed: "lightning", targetBlocks: 1 },
  ],
  state: "ok",
  tipHeight: 157_401,
};
const answered = (fees: ChainFees): FeeMarket => ({ fees, status: "answered" });

describe("the chain panel in the header", () => {
  it("summarises the block and the spread of rates, and tells each speed with its wait, rate and example cost", async () => {
    const container = await mount(
      <ChainStatusPanel exampleVbytes={200} market={answered(ok)} />,
    );
    expect(container.querySelector("summary")?.textContent).toBe(
      "Block 157,401 · 1.01 to 9.00 sat/vB",
    );
    const rows = [...container.querySelectorAll("tbody tr")].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );
    expect(rows).toEqual([
      ["Slow", "about 4 h", "1.01 sat/vB", "202 sats"],
      ["Medium", "about 1 h", "3.00 sat/vB", "600 sats"],
      ["Fast", "about 30 min", "5.00 sat/vB", "1,000 sats"],
      ["Lightning", "about 15 min", "9.00 sat/vB", "1,800 sats"],
    ]);
    expect(textOf(container)).toContain("Bitcoin testnet4 · block 157,401");
    expect(textOf(container)).toContain("read 12:00:00 UTC");
    expect(textOf(container)).toContain("A 200 vB transaction");
    expect(textOf(container)).toContain(
      "You see the exact fee before you sign",
    );
  });

  it("draws nothing while loading or where no chain is followed", async () => {
    for (const market of [
      { status: "loading" } as const,
      answered({ state: "none" }),
    ]) {
      const container = await mount(
        <ChainStatusPanel exampleVbytes={200} market={market} />,
      );
      expect(container.innerHTML).toBe("");
    }
  });

  it("says the fees are unknown, and draws no rate, when the chain or the platform cannot be asked", async () => {
    for (const market of [
      answered({ chain: "Bitcoin testnet4", state: "unavailable" }),
      { status: "unreachable" } as const,
    ]) {
      const container = await mount(
        <ChainStatusPanel exampleVbytes={200} market={market} />,
      );
      expect(container.querySelector("summary")?.textContent).toBe(
        "Fees unknown",
      );
      expect(textOf(container)).not.toMatch(/sat\/vB/u);
    }
  });
});

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
      "How fast should it confirm?",
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
  function Reading({ api }: { readonly api: ChainStatusApi }) {
    const market = useFeeQuotes({ api, refreshMs: 60_000 });
    return (
      <p>
        {market.status === "answered"
          ? `answered ${market.fees.state}`
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
});

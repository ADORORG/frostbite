import { mount } from "@frostbite/test-kit/dom";
import { describe, expect, it } from "vitest";

import { costBreakdown } from "../src/domain/fee-copy.ts";
import { CostOverview, NetworkFee } from "../src/ui/cost-overview.tsx";

describe("telling what a transaction costs", () => {
  it("tells the satoshis, the rate, the speed with its wait, and the size the fee implies", () => {
    expect(
      costBreakdown({
        asset: "btc",
        baseUnits: "5050",
        detail: { approxMinutes: 250, satPerVb: 25.25, speed: "slow" },
      }),
    ).toEqual({
      details: ["Priced at 25 sat/vB", "Slow, about 4 h", "About 200 vB"],
      total: "5,050 sats",
    });
  });

  it("leaves out the speed when the builder named none, and the wait when it gave none", () => {
    expect(
      costBreakdown({
        asset: "btc",
        baseUnits: "300",
        detail: { satPerVb: 1.5 },
      }).details,
    ).toEqual(["Priced at 1.50 sat/vB", "About 200 vB"]);
    expect(
      costBreakdown({
        asset: "btc",
        baseUnits: "300",
        detail: { satPerVb: 1.5, speed: "fast" },
      }).details,
    ).toEqual(["Priced at 1.50 sat/vB", "Fast", "About 200 vB"]);
  });

  it("tells only the amount when there is no detail, and the amount with its asset for any other coin", () => {
    expect(costBreakdown({ asset: "btc", baseUnits: "1234567" })).toEqual({
      details: [],
      total: "1,234,567 sats",
    });
    expect(
      costBreakdown({
        asset: "sim",
        baseUnits: "12",
        detail: { satPerVb: 2, speed: "slow" },
      }),
    ).toEqual({ details: [], total: "12 sim" });
  });

  it("renders the total and one list item per detail, and no list without details", async () => {
    const full = await mount(
      <CostOverview
        asset="btc"
        baseUnits="400"
        detail={{ satPerVb: 2, speed: "medium" }}
      />,
    );
    expect(full.querySelector(".cost-overview__total")?.textContent).toBe(
      "400 sats",
    );
    expect(
      [...full.querySelectorAll("li")].map((item) => item.textContent),
    ).toEqual(["Priced at 2.00 sat/vB", "Medium", "About 200 vB"]);
    const bare = await mount(<CostOverview asset="sim" baseUnits="9" />);
    expect(bare.textContent).toBe("9 sim");
    expect(bare.querySelector("ul")).toBeNull();
  });
});

describe("the fee set apart for what is about to be signed", () => {
  it("names itself the network fee and carries the whole cost overview", async () => {
    const box = await mount(
      <NetworkFee
        asset="btc"
        baseUnits="400"
        detail={{ satPerVb: 2, speed: "medium" }}
      />,
    );
    expect(box.querySelector(".network-fee__label")?.textContent).toBe(
      "Network fee",
    );
    expect(
      box.querySelector(".network-fee .cost-overview__total")?.textContent,
    ).toBe("400 sats");
  });
});

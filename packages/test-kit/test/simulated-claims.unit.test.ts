import { describe, expect, it } from "vitest";

import { simulatedAddress } from "../src/simulated-chain/address.ts";
import { signSimulated } from "../src/simulated-chain/transaction.ts";
import { funding, one, simulatedPorts } from "./support/chains.ts";

// A claim built, signed and broadcast through the simulated adapter's own ports, as a service would.
async function claim(
  over: Partial<ReturnType<typeof simulatedPorts>["claimIntent"]> = {},
) {
  const ports = simulatedPorts();
  const unsigned = await ports
    .need("builder")
    .build({ ...ports.claimIntent, ...over }, funding);
  const signed = signSimulated(unsigned);
  const outcome = await ports.need("broadcaster").broadcast(signed);
  if (outcome.kind !== "accepted") throw new Error("not accepted");
  return { ...ports, outcome, signed, unsigned };
}

describe("a claim on the simulated chain", () => {
  it("is shown as the milestone, the contract and the one who receives it", async () => {
    const { contract, sender, unsigned } = await claim();
    expect(unsigned.summary).toMatchObject({
      milestone: { contract, id: "first-win" },
      operation: "mint-milestone",
      recipient: sender,
    });
  });

  it("refuses a signed claim whose payload names another milestone than the summary shows", async () => {
    const ports = simulatedPorts();
    const builder = ports.need("builder");
    const unsigned = await builder.build(ports.claimIntent, funding);
    const forged = {
      ...unsigned,
      summary: {
        ...unsigned.summary,
        milestone: { contract: ports.contract, id: "other-win" },
      },
    };
    expect(builder.verifySigned(forged, signSimulated(forged))).toEqual({
      ok: false,
      reason: "summary-mismatch",
    });
  });

  it("counts for its holder only once it is past the finality depth", async () => {
    const { contract, controls, need, sender } = await claim();
    const rewards = need("rewards");
    expect(await rewards.claimed(contract, sender, "first-win")).toBe(0);
    controls.advance(one, 2);
    expect(await rewards.claimed(contract, sender, "first-win")).toBe(0);
    controls.advance(one, 1);
    expect(await rewards.claimed(contract, sender, "first-win")).toBe(1);
  });

  it("counts each claim of the same milestone by the same holder, and no one else's", async () => {
    const ports = simulatedPorts();
    const { claimIntent, contract, controls, need, sender } = ports;
    const builder = need("builder");
    for (let times = 0; times < 2; times += 1) {
      const unsigned = await builder.build(claimIntent, funding);
      await need("broadcaster").broadcast(signSimulated(unsigned));
    }
    controls.advance(one, 3);
    const rewards = need("rewards");
    expect(await rewards.claimed(contract, sender, "first-win")).toBe(2);
    expect(
      await rewards.claimed(
        contract,
        simulatedAddress(one, "a0a0a0"),
        "first-win",
      ),
    ).toBe(0);
    expect(await rewards.claimed(contract, sender, "other-win")).toBe(0);
    expect(
      await rewards.claimed(
        { ...contract, id: "rewards-2" },
        sender,
        "first-win",
      ),
    ).toBe(0);
  });

  it("does not count a transfer, which is not a claim", async () => {
    const ports = simulatedPorts();
    const unsigned = await ports.need("builder").build(ports.intent, funding);
    await ports.need("broadcaster").broadcast(signSimulated(unsigned));
    ports.controls.advance(one, 3);
    expect(
      await ports
        .need("rewards")
        .claimed(ports.contract, ports.sender, "first-win"),
    ).toBe(0);
  });

  it("is observed as reverted, with no effect, once the network says it failed", async () => {
    const { contract, controls, need, outcome, sender } = await claim();
    controls.advance(one, 3);
    controls.revert(outcome.ref);
    expect(await need("observer").observe(outcome.ref)).toMatchObject({
      confirmations: 3,
      status: "reverted",
    });
    expect(await need("rewards").claimed(contract, sender, "first-win")).toBe(
      0,
    );
    expect(await need("reader").transaction(outcome.ref)).toMatchObject({
      status: "failed",
    });
  });

  it("cannot revert a transaction the network never saw", () => {
    const { controls } = simulatedPorts();
    expect(() => controls.revert({ chain: one, id: "nothing" })).toThrow(
      "Only a transaction the network has seen can revert.",
    );
  });
});

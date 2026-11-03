import { describe, expect, it } from "vitest";

import { chainStatusConfig } from "@repo/configs/chain-status";
import { gameAdminConfig } from "@repo/configs/game-admin";
import { rewardsPolicy } from "@repo/configs/rewards-policy";
import { gameWalletConfig } from "@repo/configs/wallet";

// The server serves an old reading of the chain status for no longer than `maxStaleMs`; a page must stop showing one at the same age, or
// the two would say different things. There is one value, and every page that follows the status is given it.
describe("how long an old reading of the chain status lasts", () => {
  it("is one value: what the server serves by is what every page forgets by", () => {
    expect(rewardsPolicy.statusPolling.forgetAfterMs).toBe(
      rewardsPolicy.statusReadings.maxStaleMs,
    );
  });

  it("is given to the header pill, the staff signer and the player's claim", () => {
    expect(chainStatusConfig.polling).toBe(rewardsPolicy.statusPolling);
    expect(gameAdminConfig.fees.polling).toBe(rewardsPolicy.statusPolling);
    expect(gameWalletConfig.fees.polling).toBe(rewardsPolicy.statusPolling);
  });

  it("asks again more often than a reading is shared, and tolerates at least a few failed asks before calling a reading old", () => {
    expect(rewardsPolicy.statusPolling.refreshMs).toBeGreaterThan(
      rewardsPolicy.statusReadings.freshMs,
    );
    expect(rewardsPolicy.statusPolling.forgetAfterMs).toBeGreaterThan(
      rewardsPolicy.statusPolling.refreshMs * 2,
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const checked = vi.fn<() => Promise<void>>();
vi.mock("../../../configs/game-rewards", () => ({
  checkRewardsChainAtStartup: checked,
}));

import { register } from "../src/instrumentation.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  checked.mockReset();
});

describe("the server's start", () => {
  it("looks at the rewards chain's settings in the Node.js runtime, and stops where they cannot work", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    checked.mockResolvedValueOnce();
    await expect(register()).resolves.toBeUndefined();
    expect(checked).toHaveBeenCalledTimes(1);
    checked.mockRejectedValueOnce(new Error("REWARDS_FEE_API_URL is bad"));
    await expect(register()).rejects.toThrow("REWARDS_FEE_API_URL is bad");
  });

  it.each(["edge", ""])(
    "does not look where the runtime is %j, which has no chain",
    async (runtime) => {
      vi.stubEnv("NEXT_RUNTIME", runtime);
      await register();
      expect(checked).not.toHaveBeenCalled();
    },
  );
});

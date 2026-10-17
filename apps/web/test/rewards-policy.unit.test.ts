import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rewardsPolicy } from "../../../configs/rewards-policy.ts";

const abi = (name: string): { version: string } =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          `../../../contracts/templates/abi/${name}@1.json`,
          import.meta.url,
        ),
      ),
      "utf8",
    ),
  ) as { version: string };

describe("the rewards policy", () => {
  it("lists each template at the version its published interface states, with a released code hash", () => {
    for (const template of rewardsPolicy.templates) {
      expect(template.version).toBe(abi(template.crate).version);
      expect(template.codeHash).toMatch(/^[0-9a-f]{64}$/u);
    }
    expect(
      new Set(rewardsPolicy.templates.map(({ codeHash }) => codeHash)).size,
    ).toBe(rewardsPolicy.templates.length);
  });

  it("keeps the change output at or above the relay dust limit and the claim output above the change", () => {
    expect(rewardsPolicy.changeDustSats).toBeGreaterThanOrEqual(294n);
    expect(rewardsPolicy.claimOutputSats).toBeGreaterThan(
      rewardsPolicy.changeDustSats,
    );
  });
});

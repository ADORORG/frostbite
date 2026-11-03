import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { maxAdminPayloadChars } from "@ador/shared/games";

import release from "../../../contracts/templates/release.json" with { type: "json" };
import { rewardsPolicy } from "@repo/configs/rewards-policy";

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

  it("reads back at least as much picture as a contract may be created to keep", () => {
    expect(BigInt(rewardsPolicy.maxPreviewBytes)).toBeGreaterThanOrEqual(
      rewardsPolicy.maxDrawingBytes,
    );
  });

  it("keeps the change output at or above the relay dust limit and the claim output above the change", () => {
    expect(rewardsPolicy.changeDustSats).toBeGreaterThanOrEqual(294n);
    expect(rewardsPolicy.claimOutputSats).toBeGreaterThan(
      rewardsPolicy.changeDustSats,
    );
  });

  it("allows templates no larger than the step that publishes one can hold", () => {
    // A transaction carries code as bytes the page and the record keep as base64 text, a third larger; the size test in the chain
    // package builds the largest such step and checks it against the same bound.
    expect(
      Math.ceil((rewardsPolicy.maxTemplateCodeBytes * 4) / 3),
    ).toBeLessThan(maxAdminPayloadChars);
    expect(rewardsPolicy.maxTemplateCodeBytes).toBe(320 * 1024);
  });

  it("allows every released template, with room to grow", () => {
    for (const { bytes } of Object.values(release)) {
      expect(bytes).toBeLessThanOrEqual(rewardsPolicy.maxTemplateCodeBytes);
    }
    const largest = Math.max(...Object.values(release).map((t) => t.bytes));
    expect(rewardsPolicy.maxTemplateCodeBytes).toBeGreaterThan(largest * 1.05);
  });
});

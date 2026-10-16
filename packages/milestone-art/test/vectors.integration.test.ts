import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { sanitizeDrawing } from "../src/index.ts";
import { policy } from "./support.ts";

// The contract templates publish drawings both the contract and this sanitiser must agree on: canonical ones pass both and come
// out of the sanitiser unchanged; the others are refused by both.
const file = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../contracts/templates/abi/drawing-vectors.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as {
  readonly canonical: readonly string[];
  readonly contractRefuses: readonly string[];
};

describe("the shared drawing vectors", () => {
  it("come out of the sanitiser unchanged", () => {
    expect(file.canonical.length).toBeGreaterThanOrEqual(3);
    for (const drawing of file.canonical) {
      expect(sanitizeDrawing(drawing, policy), drawing).toEqual({
        ok: true,
        svg: drawing,
      });
    }
  });

  it("are refused when the contract refuses them", () => {
    expect(file.contractRefuses.length).toBeGreaterThanOrEqual(3);
    for (const drawing of file.contractRefuses) {
      expect(sanitizeDrawing(drawing, policy).ok, drawing).toBe(false);
    }
  });
});

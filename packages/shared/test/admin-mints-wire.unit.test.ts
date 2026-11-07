import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  getPlatformFeeResponseSchema,
  listGameMintsInputSchema,
  listGameMintsResponseSchema,
  listGameMintTotalsResponseSchema,
  setPlatformFeeInputSchema,
  setPlatformFeeResponseSchema,
} from "../src/games/admin-mints.ts";

// The platform publishes its routes as an OpenAPI document made from these schemas, and a schema with a transform has no form in it. This
// is the check that none of the mint and fee schemas is one, made here so it fails where the schema is written, not in the document.
describe("the mint and fee schemas", () => {
  it.each([
    ["listGameMintsInput", listGameMintsInputSchema],
    ["listGameMintsResponse", listGameMintsResponseSchema],
    ["listGameMintTotalsResponse", listGameMintTotalsResponseSchema],
    ["getPlatformFeeResponse", getPlatformFeeResponseSchema],
    ["setPlatformFeeInput", setPlatformFeeInputSchema],
    ["setPlatformFeeResponse", setPlatformFeeResponseSchema],
  ])("can be described in JSON Schema: %s", (_name, schema) => {
    expect(() => z.toJSONSchema(schema)).not.toThrow();
  });

  it("name a chain by its text, and refuse text that is not a chain", () => {
    const input = { chain: "simnet:one", feeUnits: "1500", treasury: "t" };
    expect(setPlatformFeeInputSchema.safeParse(input).success).toBe(true);
    expect(
      setPlatformFeeInputSchema.safeParse({ ...input, chain: "not a chain" })
        .success,
    ).toBe(false);
  });
});

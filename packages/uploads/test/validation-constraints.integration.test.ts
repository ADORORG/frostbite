import { assets } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  now,
  seed,
  sha,
  useValidationDatabase,
} from "./support/validation-database.ts";

useValidationDatabase();

describe("asset validation persistence constraints", () => {
  it.each([
    [
      "validated without a hash",
      {
        processingState: "validated",
        validationCompletedAt: now,
        validatorVersion: "v",
        validatedEntityTag: "e",
        detectedContentType: "image/png",
        widthPixels: 1,
        heightPixels: 1,
      },
    ],
    [
      "validated with a malformed hash",
      {
        processingState: "validated",
        validationCompletedAt: now,
        validatorVersion: "v",
        validatedEntityTag: "e",
        detectedContentType: "image/png",
        widthPixels: 1,
        heightPixels: 1,
        contentSha256: "XYZ",
      },
    ],
    [
      "validated with zero width",
      {
        processingState: "validated",
        validationCompletedAt: now,
        validatorVersion: "v",
        validatedEntityTag: "e",
        detectedContentType: "image/png",
        widthPixels: 0,
        heightPixels: 1,
        contentSha256: sha,
      },
    ],
    [
      "validated carrying a rejection reason",
      {
        processingState: "validated",
        validationCompletedAt: now,
        validatorVersion: "v",
        validatedEntityTag: "e",
        detectedContentType: "image/png",
        widthPixels: 1,
        heightPixels: 1,
        contentSha256: sha,
        rejectionReason: "malformed",
      },
    ],
    [
      "rejected without a reason",
      {
        processingState: "rejected",
        validationCompletedAt: now,
        validatorVersion: "v",
      },
    ],
    [
      "rejected carrying a hash",
      {
        processingState: "rejected",
        validationCompletedAt: now,
        validatorVersion: "v",
        rejectionReason: "malformed",
        contentSha256: sha,
      },
    ],
    ["pending carrying a reason", { rejectionReason: "malformed" }],
    ["pending carrying a hash", { contentSha256: sha }],
  ] as const)("the database refuses %s", async (_name, values) => {
    const { assetId } = await seed();
    await expect(
      database.update(assets).set(values).where(eq(assets.id, assetId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});

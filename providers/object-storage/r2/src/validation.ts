import { z } from "zod";

const contentType = z
  .string()
  .trim()
  .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/);

export const objectTransferSchema = z.object({
  contentLength: z.number().int().nonnegative(),
  contentType,
});

// Seven days is the longest lifetime SigV4 presigned URLs allow.
const expiresInSeconds = z.number().int().min(1).max(604_800);

export const presignSchema = objectTransferSchema.extend({ expiresInSeconds });
export const readPresignSchema = z.object({ expiresInSeconds });

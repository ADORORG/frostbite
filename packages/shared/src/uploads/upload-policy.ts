import { z } from "zod";

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const megabyte = 1_000_000;
const megapixel = 1_000_000;

export const uploadPurposes = [
  "collection-artwork",
  "collection-banner",
  "collection-item-artwork",
  "creator-avatar",
] as const;

export const uploadPurposeSchema = z.enum(uploadPurposes);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

const policySchema = z
  .object({
    activeIntentLimitPerUser: z.number().int().min(1).max(100),
    cleanupDelayMs: z
      .number()
      .int()
      .min(hourMs)
      .max(30 * dayMs),
    // Bounds decoded memory: ADR-004 requires dimension and pixel limits as typed policy.
    // Persisted in PostgreSQL integer columns, so larger limits could never be stored.
    maxImageDimension: z
      .number()
      .int()
      .positive()
      .max(2 ** 31 - 1),
    maxImagePixels: z.number().int().positive(),
    intentRetentionMs: z
      .number()
      .int()
      .min(dayMs)
      .max(365 * dayMs),
    maxBytesByPurpose: z.record(
      uploadPurposeSchema,
      z.number().int().positive(),
    ),
    presignedUrlLifetimeMs: z.number().int().min(minuteMs).max(hourMs),
  })
  .strict()
  .refine(
    ({ cleanupDelayMs, presignedUrlLifetimeMs }) =>
      cleanupDelayMs > presignedUrlLifetimeMs,
    "Cleanup delay must exceed the presigned URL lifetime.",
  );

export type UploadPolicy = z.infer<typeof policySchema>;
export type UploadPolicyOverrides = Omit<
  Partial<UploadPolicy>,
  "maxBytesByPurpose"
> & {
  readonly maxBytesByPurpose?: Partial<UploadPolicy["maxBytesByPurpose"]>;
};

export const defaultUploadPolicy: UploadPolicy = Object.freeze({
  activeIntentLimitPerUser: 2,
  cleanupDelayMs: dayMs,
  intentRetentionMs: 30 * dayMs,
  // Accepted 2026-10-06 for the beta: 8192 px per side and 40 megapixels decoded.
  maxImageDimension: 8192,
  maxImagePixels: 40 * megapixel,
  maxBytesByPurpose: Object.freeze({
    "collection-artwork": 25 * megabyte,
    "collection-banner": 15 * megabyte,
    "collection-item-artwork": 25 * megabyte,
    "creator-avatar": 5 * megabyte,
  }),
  presignedUrlLifetimeMs: 15 * minuteMs,
});

export function resolveUploadPolicy(
  overrides: UploadPolicyOverrides = {},
): UploadPolicy {
  return Object.freeze(
    policySchema.parse({
      ...defaultUploadPolicy,
      ...overrides,
      maxBytesByPurpose: {
        ...defaultUploadPolicy.maxBytesByPurpose,
        ...overrides.maxBytesByPurpose,
      },
    }),
  );
}

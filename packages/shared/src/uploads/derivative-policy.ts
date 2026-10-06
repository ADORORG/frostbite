import { z } from "zod";

import { derivativeKinds } from "./contracts.ts";

const megabyte = 1_000_000;

const derivativePolicySchema = z
  .object({
    // Output size caps one derivative; the decoder child is killed past the wall time.
    maxDerivativeBytes: z.number().int().positive(),
    previewMaxSide: z.number().int().positive(),
    specVersion: z.string().trim().min(1),
    thumbnailMaxSide: z.number().int().positive(),
    wallTimeMs: z.number().int().positive(),
    webpQuality: z.number().int().min(1).max(100),
    workerMaxHeapMegabytes: z.number().int().positive(),
  })
  .strict()
  .refine(
    ({ previewMaxSide, thumbnailMaxSide }) => previewMaxSide > thumbnailMaxSide,
    "The preview must be larger than the thumbnail.",
  );

export type DerivativePolicy = z.infer<typeof derivativePolicySchema>;
export type DerivativePolicyOverrides = Partial<DerivativePolicy>;

// Accepted 2026-10-06: 256 px and 1024 px lossy WebP (q80), 30 s wall time, 5 MB per derivative.
// The spec version is part of every derivative key so changed output never overwrites prior output.
export const defaultDerivativePolicy: DerivativePolicy = Object.freeze({
  maxDerivativeBytes: 5 * megabyte,
  previewMaxSide: 1_024,
  specVersion: "webp-v1",
  thumbnailMaxSide: 256,
  wallTimeMs: 30_000,
  webpQuality: 80,
  workerMaxHeapMegabytes: 512,
});

export function resolveDerivativePolicy(
  overrides: DerivativePolicyOverrides = {},
): DerivativePolicy {
  return Object.freeze(
    derivativePolicySchema.parse({ ...defaultDerivativePolicy, ...overrides }),
  );
}

export function derivativeMaxSide(
  policy: DerivativePolicy,
  kind: (typeof derivativeKinds)[number],
): number {
  return kind === "thumbnail" ? policy.thumbnailMaxSide : policy.previewMaxSide;
}

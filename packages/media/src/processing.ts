import type {
  AssetRejectionReason,
  DerivativeKind,
} from "@frostbite/shared/uploads";

import type { ImageLimits } from "./contracts.ts";

export interface DerivativeRequest {
  readonly kind: DerivativeKind;
  // Longest side of the derivative; images are never enlarged.
  readonly maxSide: number;
}

export interface ProcessImageInput {
  readonly bytes: Uint8Array;
  readonly derivatives: readonly DerivativeRequest[];
  // Dimensions recorded by structural validation, which the decoder must confirm.
  readonly expected: { readonly height: number; readonly width: number };
  readonly limits: ImageLimits;
  readonly quality: number;
}

export interface ProducedDerivative {
  readonly bytes: Uint8Array;
  readonly height: number;
  readonly kind: DerivativeKind;
  readonly width: number;
}

export type ProcessImageResult =
  | { readonly derivatives: readonly ProducedDerivative[]; readonly ok: true }
  | { readonly ok: false; readonly reason: AssetRejectionReason };

// Implemented by an isolated decoder. Deterministic failures return a rejection reason; an
// implementation never returns partial output.
export interface ImageProcessor {
  process(input: ProcessImageInput): Promise<ProcessImageResult>;
}

export type { MediaProcessingProviderServices } from "./provider-service.ts";

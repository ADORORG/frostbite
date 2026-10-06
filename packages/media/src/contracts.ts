import type {
  AssetRejectionReason,
  UploadContentType,
} from "@ador/shared/uploads";

// Names the structural parser generation; stored with each outcome so a later decoder-backed
// validator (W3-05) can be told apart from results produced here.
export const mediaValidatorVersion = "structural-v1";

export interface ImageLimits {
  readonly maxDimension: number;
  readonly maxPixels: number;
}

export interface ImageGeometry {
  readonly height: number;
  readonly mediaType: UploadContentType;
  readonly width: number;
}

export type FormatParseResult =
  | ({ readonly ok: true } & ImageGeometry)
  | { readonly ok: false; readonly reason: AssetRejectionReason };

export const malformed: FormatParseResult = {
  ok: false,
  reason: "malformed",
};
export const animated: FormatParseResult = {
  ok: false,
  reason: "animation-unsupported",
};

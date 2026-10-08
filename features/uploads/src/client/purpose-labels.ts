import { uploadPurposes, type UploadPurpose } from "@ador/shared/uploads";

// Display names for every upload purpose, keyed by the exhaustive purpose union.
export const purposeLabels: Readonly<Record<UploadPurpose, string>> = {
  "collection-artwork": "Collection artwork",
  "collection-banner": "Collection banner",
  "collection-item-artwork": "Collection item artwork",
  "creator-avatar": "Creator avatar",
};

export const purposeOptions: readonly {
  readonly label: string;
  readonly value: UploadPurpose;
}[] = uploadPurposes.map((value) => ({ label: purposeLabels[value], value }));

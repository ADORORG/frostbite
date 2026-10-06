import { createHash } from "node:crypto";

import { parseObjectKey } from "@ador/object-storage/contracts";
import { createUuidV7 } from "@ador/shared/identifiers";
import {
  defaultDerivativePolicy,
  defaultUploadPolicy,
  type resolveDerivativePolicy,
} from "@ador/shared/uploads";

import type { AssetProcessingSubject } from "../../src/application/processing-repository.ts";
import { createAssetProcessingService } from "../../src/application/processing-service.ts";
import { providerId, tinyPng } from "./images.ts";
import {
  fakeProcessor,
  memoryProcessingRepository,
  processingStorage,
} from "./processing-fakes.ts";

export const source = tinyPng(7, 5);
export const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export const completedAt = new Date("2026-10-06T12:00:00.000Z");
export const thumbnail = Uint8Array.of(1, 2, 3);
export const preview = Uint8Array.of(4, 5, 6, 7);
export const produced = {
  derivatives: [
    { bytes: thumbnail, height: 5, kind: "thumbnail", width: 7 },
    { bytes: preview, height: 5, kind: "preview", width: 7 },
  ],
  ok: true,
} as const;

export function setup(
  options: {
    head?: { contentLength: number } | null;
    initial?: Parameters<typeof memoryProcessingRepository>[1];
    onWrite?: (key: string, bytes: Buffer) => void;
    policy?: ReturnType<typeof resolveDerivativePolicy>;
    processor?: Parameters<typeof fakeProcessor>[0];
    source?: Uint8Array;
    subject?: Partial<AssetProcessingSubject>;
  } = {},
) {
  const subject: AssetProcessingSubject = {
    assetId: createUuidV7(),
    byteLength: source.length,
    contentSha256: sha(source),
    height: 5,
    objectKey: parseObjectKey("drafts/object"),
    storageProviderId: providerId,
    width: 7,
    ...options.subject,
  };
  const repository = memoryProcessingRepository(subject, options.initial);
  const storage = processingStorage({
    head: options.head
      ? {
          contentLength: options.head.contentLength,
          contentType: "image/webp",
          entityTag: "e",
          lastModified: completedAt,
        }
      : null,
    onWrite: options.onWrite,
    source: options.source ?? source,
  });
  const processor = fakeProcessor(options.processor ?? produced);
  const service = createAssetProcessingService({
    clock: () => completedAt,
    createId: createUuidV7,
    derivativePolicy: options.policy ?? defaultDerivativePolicy,
    processor,
    repository,
    storage: storage.storage,
    uploadPolicy: defaultUploadPolicy,
  });
  return { processor, repository, service, storage, subject };
}

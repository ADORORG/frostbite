import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import type { ImageProcessor } from "@frostbite/media/processing";
import {
  parseObjectKey,
  type ObjectKey,
  type ObjectStoragePort,
} from "@frostbite/object-storage/contracts";
import { ObjectStorageError } from "@frostbite/object-storage/errors";
import { uuidV7Schema, type UuidV7 } from "@frostbite/shared/identifiers";
import {
  derivativeMaxSide,
  derivativeKinds,
  type DerivativePolicy,
  type UploadPolicy,
} from "@frostbite/shared/uploads";

import { readUpTo } from "./bounded-read.ts";
import type {
  AssetProcessingOutcome,
  AssetProcessingRecording,
  AssetProcessingRepository,
  AssetProcessingSubject,
  StoredDerivative,
} from "./processing-repository.ts";

export type AssetProcessingResult =
  | { readonly kind: "unavailable" }
  | { readonly kind: "provider-mismatch" }
  | { readonly kind: "not-ready" }
  | AssetProcessingRecording;

const derivativeContentType = "image/webp";

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export function createAssetProcessingService(dependencies: {
  readonly clock: () => Date;
  readonly createId: () => UuidV7;
  readonly derivativePolicy: DerivativePolicy;
  readonly processor: ImageProcessor;
  readonly repository: AssetProcessingRepository;
  readonly storage: ObjectStoragePort;
  readonly uploadPolicy: UploadPolicy;
}) {
  const { derivativePolicy, processor, repository, storage, uploadPolicy } =
    dependencies;

  // Content-addressed and spec-versioned, so a retry rewrites identical bytes and a changed spec
  // never overwrites earlier output.
  function derivativeKey(
    assetId: UuidV7,
    kind: string,
    hash: string,
  ): ObjectKey {
    return parseObjectKey(
      `derivatives/${assetId}/${derivativePolicy.specVersion}/${kind}-${hash}.webp`,
    );
  }

  async function store(key: ObjectKey, bytes: Uint8Array): Promise<void> {
    try {
      await storage.write({
        body: Readable.from([Buffer.from(bytes)]),
        contentLength: bytes.length,
        contentType: derivativeContentType,
        ifAbsent: true,
        key,
        scope: "private",
      });
    } catch (error) {
      if (!(error instanceof ObjectStorageError) || error.code !== "conflict")
        throw error;
      // The key embeds the content hash, so an existing object of this length is this object.
      const existing = await storage.head({ key, scope: "private" });
      if (existing?.contentLength !== bytes.length) throw error;
    }
  }

  async function process(
    subject: AssetProcessingSubject,
  ): Promise<AssetProcessingOutcome> {
    const stored = await storage.read({
      key: subject.objectKey,
      scope: "private",
    });
    const bytes = await readUpTo(stored.body, subject.byteLength);
    // A longer object is cut off by the read cap; a shorter one cannot match the recorded hash.
    if (bytes === null || sha256(bytes) !== subject.contentSha256)
      return { reason: "content-changed", state: "unprocessable" };
    const result = await processor.process({
      bytes,
      derivatives: derivativeKinds.map((kind) => ({
        kind,
        maxSide: derivativeMaxSide(derivativePolicy, kind),
      })),
      expected: { height: subject.height, width: subject.width },
      limits: {
        maxDimension: uploadPolicy.maxImageDimension,
        maxPixels: uploadPolicy.maxImagePixels,
      },
      quality: derivativePolicy.webpQuality,
    });
    if (!result.ok) return { reason: result.reason, state: "unprocessable" };
    const derivatives: StoredDerivative[] = [];
    for (const derivative of result.derivatives) {
      const contentSha256 = sha256(derivative.bytes);
      const objectKey = derivativeKey(
        subject.assetId,
        derivative.kind,
        contentSha256,
      );
      await store(objectKey, derivative.bytes);
      derivatives.push({
        byteLength: derivative.bytes.length,
        contentSha256,
        contentType: derivativeContentType,
        height: derivative.height,
        kind: derivative.kind,
        objectKey,
        specVersion: derivativePolicy.specVersion,
        storageProviderId: storage.providerId,
        width: derivative.width,
      });
    }
    return { derivatives, state: "processed" };
  }

  return {
    // Storage, decoder-launch, and worker-protocol failures throw before any state change, leaving
    // the asset `validated` and retryable. Deterministic file problems become `unprocessable`.
    async process(input: {
      readonly assetId: string;
    }): Promise<AssetProcessingResult> {
      const assetId = uuidV7Schema.safeParse(input.assetId);
      if (!assetId.success) return { kind: "unavailable" };
      const lookup = await repository.find(assetId.data);
      if (lookup.kind === "missing") return { kind: "unavailable" };
      if (lookup.kind === "not-ready") return { kind: "not-ready" };
      if (lookup.kind === "final")
        return { kind: "replayed", outcome: lookup.outcome };
      if (lookup.subject.storageProviderId !== storage.providerId)
        return { kind: "provider-mismatch" };
      return repository.record({
        assetId: assetId.data,
        completedAt: dependencies.clock(),
        createId: dependencies.createId,
        outcome: await process(lookup.subject),
      });
    },
  };
}

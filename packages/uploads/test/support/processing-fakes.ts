import { Readable } from "node:stream";

import type {
  ImageProcessor,
  ProcessImageInput,
  ProcessImageResult,
} from "@frostbite/media/processing";
import type {
  ObjectKey,
  ObjectStoragePort,
  StoredObjectMetadata,
} from "@frostbite/object-storage/contracts";
import { ObjectStorageError } from "@frostbite/object-storage/errors";
import type { UuidV7 } from "@frostbite/shared/identifiers";

import type {
  AssetProcessingLookup,
  AssetProcessingOutcome,
  AssetProcessingRepository,
  AssetProcessingSubject,
} from "../../src/application/processing-repository.ts";
import { providerId } from "./images.ts";

// Mirrors the port contract: first conditional record wins and is returned to every caller.
export function memoryProcessingRepository(
  subject: AssetProcessingSubject,
  initial?: AssetProcessingLookup,
) {
  let outcome: AssetProcessingOutcome | undefined;
  const repository: AssetProcessingRepository & {
    readonly recorded: AssetProcessingOutcome[];
  } = {
    recorded: [],
    async find(assetId: UuidV7): Promise<AssetProcessingLookup> {
      if (assetId !== subject.assetId) return { kind: "missing" };
      if (outcome !== undefined) return { kind: "final", outcome };
      return initial ?? { kind: "pending", subject };
    },
    async record(input) {
      repository.recorded.push(input.outcome);
      if (outcome !== undefined) return { kind: "replayed", outcome };
      outcome = input.outcome;
      return { kind: "recorded", outcome };
    },
  };
  return repository;
}

export interface StorageScript {
  // Called for each write; throw to simulate provider behavior.
  readonly onWrite?: (key: string, bytes: Buffer) => void;
  readonly head?: StoredObjectMetadata | null;
  readonly source: Uint8Array;
}

export function processingStorage(script: StorageScript) {
  const writes: {
    bytes: Buffer;
    contentLength: number;
    contentType: string;
    ifAbsent: boolean;
    key: ObjectKey;
    scope: string;
  }[] = [];
  const reads: ObjectKey[] = [];
  const unused = async (): Promise<never> => {
    throw new Error("Not used by processing.");
  };
  const storage: ObjectStoragePort = {
    copyPrivateToPublicIfAbsent: unused,
    delete: unused,
    head: async () => script.head ?? null,
    presignPrivateRead: unused,
    presignPrivateUpload: unused,
    providerId,
    read: async ({ key }) => {
      reads.push(key);
      return {
        body: Readable.from([Buffer.from(script.source)]),
        contentLength: script.source.length,
        contentType: "image/png",
        entityTag: "etag",
        lastModified: new Date("2026-10-06T12:00:00.000Z"),
      };
    },
    write: async (input) => {
      const chunks: Buffer[] = [];
      for await (const chunk of input.body) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      script.onWrite?.(input.key, bytes);
      writes.push({
        bytes,
        contentLength: input.contentLength,
        contentType: input.contentType,
        ifAbsent: input.ifAbsent,
        key: input.key,
        scope: input.scope,
      });
      return {
        contentLength: bytes.length,
        contentType: input.contentType,
        entityTag: "written",
        lastModified: new Date("2026-10-06T12:00:00.000Z"),
      };
    },
  };
  return { reads, storage, writes };
}

export function conflict(): ObjectStorageError {
  return new ObjectStorageError("conflict", "exists");
}

export function fakeProcessor(
  result: ProcessImageResult | Error,
): ImageProcessor & { readonly inputs: ProcessImageInput[] } {
  const inputs: ProcessImageInput[] = [];
  return {
    inputs,
    async process(input) {
      inputs.push(input);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

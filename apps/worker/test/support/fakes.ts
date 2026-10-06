import { Readable } from "node:stream";

import type { ImageProcessor } from "@ador/media/processing";
import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import { ObjectStorageError } from "@ador/object-storage/errors";
import { providerIdSchema } from "@ador/shared/providers";

export const storageProviderId = providerIdSchema.parse("test-object-storage");

export function memoryStorage() {
  const objects = new Map<string, Buffer>();
  const writes: string[] = [];
  let failReads = false;
  const unused = async (): Promise<never> => {
    throw new Error("Not used by the pipeline.");
  };
  const storage: ObjectStoragePort = {
    copyPrivateToPublicIfAbsent: unused,
    delete: unused,
    head: async ({ key }) => {
      const object = objects.get(key);
      return object === undefined
        ? null
        : {
            contentLength: object.length,
            contentType: "image/webp",
            entityTag: "e",
            lastModified: new Date(),
          };
    },
    presignPrivateUpload: unused,
    providerId: storageProviderId,
    read: async ({ key }) => {
      if (failReads)
        throw new ObjectStorageError("provider-failure", "storage unavailable");
      const object = objects.get(key);
      if (object === undefined)
        throw new ObjectStorageError("not-found", "missing");
      return {
        body: Readable.from([object]),
        contentLength: object.length,
        contentType: "image/png",
        entityTag: "etag",
        lastModified: new Date(),
      };
    },
    write: async ({ body, key }) => {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      objects.set(key, bytes);
      writes.push(key);
      return {
        contentLength: bytes.length,
        contentType: "image/webp",
        entityTag: "w",
        lastModified: new Date(),
      };
    },
  };
  return {
    failReads: (value: boolean) => void (failReads = value),
    objects,
    storage,
    writes,
  };
}

export function countingProcessor() {
  let calls = 0;
  const processor: ImageProcessor = {
    process: async ({ derivatives }) => {
      calls += 1;
      return {
        derivatives: derivatives.map(({ kind }) => ({
          bytes: Uint8Array.of(1, 2, 3),
          height: 5,
          kind,
          width: 7,
        })),
        ok: true,
      };
    },
  };
  return { calls: () => calls, processor };
}

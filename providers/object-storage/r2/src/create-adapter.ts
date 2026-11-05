import type {
  ObjectStoragePort,
  StorageScope,
  StoredObjectMetadata,
} from "@frostbite/object-storage/contracts";
import { ObjectStorageError } from "@frostbite/object-storage/errors";

import { r2ConfigSchema, type R2Config } from "./config.ts";
import { toStoredMetadata, toStoredObject } from "./metadata.ts";
import { createR2Client, type R2ClientPort } from "./r2-client.ts";
import { translateProviderError } from "./provider-errors.ts";
import {
  objectTransferSchema,
  presignSchema,
  readPresignSchema,
} from "./validation.ts";
import { r2ObjectStorageProviderId } from "./identity.ts";

function bucketFor(config: R2Config, scope: StorageScope): string {
  return scope === "private" ? config.privateBucket : config.publicBucket;
}

async function providerRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof ObjectStorageError) throw error;
    throw translateProviderError(error);
  }
}

async function metadataAfterWrite(
  client: R2ClientPort,
  bucket: string,
  key: string,
): Promise<StoredObjectMetadata> {
  return toStoredMetadata(
    await providerRequest(() => client.head({ bucket, key })),
  );
}

async function existingPublishedVersion(
  client: R2ClientPort,
  config: R2Config,
  key: string,
  sourceEntityTag: string,
): Promise<StoredObjectMetadata | null> {
  try {
    const metadata = await metadataAfterWrite(client, config.publicBucket, key);
    return metadata.entityTag === sourceEntityTag ? metadata : null;
  } catch (error) {
    if (error instanceof ObjectStorageError && error.code === "not-found")
      return null;
    throw error;
  }
}

// A signed URL must use https, or be served from the configured endpoint itself, which the
// configuration has already restricted to https or loopback-only plain http.
function parsePresignedUrl(value: string, endpoint: string): URL {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.origin !== new URL(endpoint).origin)
      throw new Error("Presigned URL must use HTTPS.");
    return url;
  } catch (error) {
    throw new ObjectStorageError(
      "invalid-provider-response",
      "Object-storage provider returned an invalid presigned URL.",
      { cause: error },
    );
  }
}

export function createR2ObjectStorage(
  unvalidatedConfig: R2Config,
  clientOverride?: R2ClientPort,
): ObjectStoragePort {
  const config = r2ConfigSchema.parse(unvalidatedConfig);
  const client = clientOverride ?? createR2Client(config);

  return {
    providerId: r2ObjectStorageProviderId,
    copyPrivateToPublicIfAbsent: async ({ key, sourceEntityTag }) => {
      try {
        await providerRequest(() =>
          client.copyIfAbsent({
            destinationBucket: config.publicBucket,
            key,
            sourceBucket: config.privateBucket,
            sourceEntityTag,
          }),
        );
      } catch (error) {
        if (error instanceof ObjectStorageError && error.code === "conflict") {
          const published = await existingPublishedVersion(
            client,
            config,
            key,
            sourceEntityTag,
          );
          if (published) return published;
        }
        throw error;
      }
      return metadataAfterWrite(client, config.publicBucket, key);
    },
    delete: ({ key, scope }) =>
      providerRequest(() =>
        client.delete({ bucket: bucketFor(config, scope), key }),
      ),
    head: async ({ key, scope }) => {
      try {
        return toStoredMetadata(
          await providerRequest(() =>
            client.head({ bucket: bucketFor(config, scope), key }),
          ),
        );
      } catch (error) {
        if (error instanceof ObjectStorageError && error.code === "not-found")
          return null;
        throw error;
      }
    },
    presignPrivateRead: async (input) => {
      const { expiresInSeconds } = readPresignSchema.parse(input);
      const issuedAt = Date.now();
      const url = await providerRequest(() =>
        client.presignGet({
          bucket: config.privateBucket,
          expiresInSeconds,
          key: input.key,
        }),
      );
      return {
        expiresAt: new Date(issuedAt + expiresInSeconds * 1_000),
        url: parsePresignedUrl(url, config.endpoint),
      };
    },
    presignPrivateUpload: async (input) => {
      const values = presignSchema.parse(input);
      const issuedAt = Date.now();
      const url = await providerRequest(() =>
        client.presignPut({
          ...values,
          bucket: config.privateBucket,
          key: input.key,
        }),
      );
      return {
        expiresAt: new Date(issuedAt + values.expiresInSeconds * 1_000),
        headers: Object.freeze({
          "content-length": String(values.contentLength),
          "content-type": values.contentType,
        }),
        method: "PUT",
        url: parsePresignedUrl(url, config.endpoint),
      };
    },
    read: async ({ key, scope }) =>
      toStoredObject(
        await providerRequest(() =>
          client.get({ bucket: bucketFor(config, scope), key }),
        ),
      ),
    write: async (input) => {
      if (input.scope === "public" && !input.ifAbsent) {
        throw new ObjectStorageError(
          "conflict",
          "Public objects cannot be replaced.",
        );
      }
      const values = objectTransferSchema.parse(input);
      const bucket = bucketFor(config, input.scope);
      await providerRequest(() => client.put({ ...input, ...values, bucket }));
      return metadataAfterWrite(client, bucket, input.key);
    },
  };
}

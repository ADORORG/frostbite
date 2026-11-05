import { Readable } from "node:stream";

import { ObjectStorageError } from "@frostbite/object-storage/errors";
import type {
  StoredObject,
  StoredObjectMetadata,
} from "@frostbite/object-storage/contracts";

export interface ProviderMetadata {
  readonly Body?: object;
  readonly ContentLength?: number;
  readonly ContentType?: string;
  readonly ETag?: string;
  readonly LastModified?: Date;
}

export function toStoredMetadata(
  value: ProviderMetadata,
): StoredObjectMetadata {
  if (
    value.ContentLength === undefined ||
    value.ContentLength < 0 ||
    value.ContentType === undefined ||
    value.ContentType.length === 0 ||
    value.ETag === undefined ||
    value.ETag.length === 0 ||
    value.LastModified === undefined
  ) {
    throw new ObjectStorageError(
      "invalid-provider-response",
      "Object-storage metadata was incomplete or invalid.",
    );
  }
  return {
    contentLength: value.ContentLength,
    contentType: value.ContentType,
    entityTag: value.ETag,
    lastModified: value.LastModified,
  };
}

export function toStoredObject(value: ProviderMetadata): StoredObject {
  if (!(value.Body instanceof Readable)) {
    throw new ObjectStorageError(
      "invalid-provider-response",
      "Object-storage response did not contain a Node readable stream.",
    );
  }
  return { ...toStoredMetadata(value), body: value.Body };
}

import type { Readable } from "node:stream";

import { z } from "zod";
import type { ProviderId } from "@frostbite/shared/providers";

const objectKeySchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine((value) => !value.startsWith("/"), "Object keys must be relative.")
  .refine(
    (value) => !value.split("/").includes(""),
    "Object keys cannot contain empty segments.",
  )
  .refine(
    (value) =>
      ![...value].some((character) => {
        const codePoint = character.codePointAt(0);
        return (
          codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
        );
      }),
    "Object keys cannot contain control characters.",
  )
  .brand<"ObjectKey">();

export type ObjectKey = z.infer<typeof objectKeySchema>;
export type StorageScope = "private" | "public";

export function parseObjectKey(value: string): ObjectKey {
  return objectKeySchema.parse(value);
}

export interface StoredObjectMetadata {
  readonly contentLength: number;
  readonly contentType: string;
  readonly entityTag: string;
  readonly lastModified: Date;
}

export interface StoredObject extends StoredObjectMetadata {
  readonly body: Readable;
}

export interface PresignedUpload {
  readonly expiresAt: Date;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: "PUT";
  readonly url: URL;
}

export interface PresignedRead {
  readonly expiresAt: Date;
  readonly url: URL;
}

export interface ObjectStoragePort {
  readonly providerId: ProviderId;
  copyPrivateToPublicIfAbsent(input: {
    readonly key: ObjectKey;
    readonly sourceEntityTag: string;
  }): Promise<StoredObjectMetadata>;
  delete(input: {
    readonly key: ObjectKey;
    readonly scope: StorageScope;
  }): Promise<void>;
  head(input: {
    readonly key: ObjectKey;
    readonly scope: StorageScope;
  }): Promise<StoredObjectMetadata | null>;
  presignPrivateUpload(input: {
    readonly contentLength: number;
    readonly contentType: string;
    readonly expiresInSeconds: number;
    readonly key: ObjectKey;
  }): Promise<PresignedUpload>;
  // A short-lived bearer URL for one private object; whoever holds it can read the object until it
  // expires. Callers authorize the reader before asking (ADR-016).
  presignPrivateRead(input: {
    readonly expiresInSeconds: number;
    readonly key: ObjectKey;
  }): Promise<PresignedRead>;
  read(input: {
    readonly key: ObjectKey;
    readonly scope: StorageScope;
  }): Promise<StoredObject>;
  write(input: {
    readonly body: Readable;
    readonly contentLength: number;
    readonly contentType: string;
    readonly ifAbsent: boolean;
    readonly key: ObjectKey;
    readonly scope: StorageScope;
  }): Promise<StoredObjectMetadata>;
}

import { crc32 } from "node:zlib";
import { Readable } from "node:stream";

import type {
  ObjectStoragePort,
  StoredObject,
} from "@ador/object-storage/contracts";
import { providerIdSchema } from "@ador/shared/providers";

export const providerId = providerIdSchema.parse("test-object-storage");

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

// A structurally valid PNG container; sufficient because validation is structural (W3-04).
export function tinyPng(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, width);
  new DataView(header.buffer).setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", header),
    chunk("IDAT", Uint8Array.of(0)),
    chunk("IEND", new Uint8Array()),
  ];
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

export interface FakeObject {
  readonly body?: Iterable<Uint8Array | string>;
  readonly bytes: Uint8Array;
  readonly contentLength?: number;
  readonly entityTag?: string;
}

export function fakeStorage(
  object: FakeObject | Error,
  id = providerId,
): ObjectStoragePort & { readonly reads: number[] } {
  const reads: number[] = [];
  const unused = async (): Promise<never> => {
    throw new Error("Not used by validation.");
  };
  return {
    copyPrivateToPublicIfAbsent: unused,
    delete: unused,
    head: unused,
    presignPrivateUpload: unused,
    providerId: id,
    read: async (): Promise<StoredObject> => {
      reads.push(1);
      if (object instanceof Error) throw object;
      return {
        body: Readable.from(object.body ?? [Buffer.from(object.bytes)]),
        contentLength: object.contentLength ?? object.bytes.length,
        contentType: "application/octet-stream",
        entityTag: object.entityTag ?? "etag-1",
        lastModified: new Date("2026-10-06T12:00:00.000Z"),
      };
    },
    reads,
    write: unused,
  };
}

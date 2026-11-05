import { Readable } from "node:stream";

import { ObjectStorageError } from "@frostbite/object-storage/errors";
import { describe, expect, it } from "vitest";

import { toStoredMetadata, toStoredObject } from "../src/metadata.ts";
import { translateProviderError } from "../src/provider-errors.ts";

const metadata = {
  ContentLength: 0,
  ContentType: "image/png",
  ETag: '"etag"',
  LastModified: new Date(0),
};

describe("R2 response boundary", () => {
  it("maps complete metadata and Node streams", () => {
    expect(toStoredMetadata(metadata)).toMatchObject({
      contentLength: 0,
      contentType: "image/png",
      entityTag: '"etag"',
    });
    const body = Readable.from(["asset"]);
    expect(toStoredObject({ ...metadata, Body: body }).body).toBe(body);
  });

  it.each([
    {},
    { ...metadata, ContentLength: -1 },
    { ...metadata, ContentType: "" },
    { ...metadata, ETag: "" },
    { ...metadata, LastModified: undefined },
  ])("rejects incomplete provider metadata", (value) => {
    expect(() => toStoredMetadata(value)).toThrowError(ObjectStorageError);
  });

  it("rejects non-Node response bodies", () => {
    expect(() => toStoredObject({ ...metadata, Body: {} })).toThrowError(
      ObjectStorageError,
    );
  });
});

describe("R2 error boundary", () => {
  it.each([
    [{ name: "NoSuchKey" }, "not-found"],
    [{ name: "NotFound" }, "not-found"],
    [{ $metadata: { httpStatusCode: 404 } }, "not-found"],
    [{ name: "PreconditionFailed" }, "conflict"],
    [{ $metadata: { httpStatusCode: 412 } }, "conflict"],
    [new Error("network"), "provider-failure"],
    ["invalid thrown value", "provider-failure"],
  ] as const)("normalizes provider failure %#", (providerError, code) => {
    expect(translateProviderError(providerError)).toMatchObject({
      code,
      cause: providerError,
    });
  });
});

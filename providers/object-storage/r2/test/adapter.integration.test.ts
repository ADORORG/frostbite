import { Readable } from "node:stream";

import { ObjectStorageError } from "@frostbite/object-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createR2ObjectStorage } from "../src/create-adapter.ts";
import { config, key } from "./support/adapter-fixtures.ts";
import { FakeR2Client } from "./support/fake-r2-client.ts";

describe("R2 object-storage adapter", () => {
  let client: FakeR2Client;

  beforeEach(() => {
    client = new FakeR2Client();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes, heads, and streams an exact private object", async () => {
    const storage = createR2ObjectStorage(config, client);
    expect(storage.providerId).toBe("r2-object-storage");
    const metadata = await storage.write({
      body: Readable.from([Buffer.from("image")]),
      contentLength: 5,
      contentType: "image/png",
      ifAbsent: true,
      key,
      scope: "private",
    });
    expect(metadata).toMatchObject({
      contentLength: 5,
      contentType: "image/png",
    });
    await expect(storage.head({ key, scope: "private" })).resolves.toEqual(
      metadata,
    );
    const stored = await storage.read({ key, scope: "private" });
    const chunks: Buffer[] = [];
    for await (const chunk of stored.body) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("image");
  });

  it("rejects an invalid provider URL and runtime attempts to replace public content", async () => {
    const storage = createR2ObjectStorage(config, client);
    client.signedUrl = "http://insecure.example.invalid/upload";
    await expect(
      storage.presignPrivateUpload({
        contentLength: 5,
        contentType: "image/png",
        expiresInSeconds: 60,
        key,
      }),
    ).rejects.toMatchObject({ code: "invalid-provider-response" });

    await expect(
      storage.write({
        body: Readable.from(["image"]),
        contentLength: 5,
        contentType: "image/png",
        ifAbsent: false,
        key,
        scope: "public",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("makes an exact publication retry idempotent", async () => {
    const storage = createR2ObjectStorage(config, client);
    await storage.write({
      body: Readable.from(["image"]),
      contentLength: 5,
      contentType: "image/png",
      ifAbsent: true,
      key,
      scope: "private",
    });
    const source = await storage.head({ key, scope: "private" });
    if (!source) throw new Error("Expected private source metadata.");
    await expect(
      storage.copyPrivateToPublicIfAbsent({
        key,
        sourceEntityTag: source.entityTag,
      }),
    ).resolves.toMatchObject({
      contentLength: 5,
    });
    await expect(
      storage.copyPrivateToPublicIfAbsent({
        key,
        sourceEntityTag: source.entityTag,
      }),
    ).resolves.toMatchObject({
      contentLength: 5,
      entityTag: source.entityTag,
    });
  });

  it("rejects replacement when the published object is a different version", async () => {
    const storage = createR2ObjectStorage(config, client);
    await storage.write({
      body: Readable.from(["published"]),
      contentLength: 9,
      contentType: "image/png",
      ifAbsent: true,
      key,
      scope: "public",
    });
    await storage.write({
      body: Readable.from(["draft"]),
      contentLength: 5,
      contentType: "image/png",
      ifAbsent: true,
      key,
      scope: "private",
    });
    const source = await storage.head({ key, scope: "private" });
    if (!source) throw new Error("Expected private source metadata.");
    await expect(
      storage.copyPrivateToPublicIfAbsent({
        key,
        sourceEntityTag: source.entityTag,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects publication when the private source no longer matches validation", async () => {
    const storage = createR2ObjectStorage(config, client);
    await storage.write({
      body: Readable.from(["image"]),
      contentLength: 5,
      contentType: "image/png",
      ifAbsent: true,
      key,
      scope: "private",
    });
    await expect(
      storage.copyPrivateToPublicIfAbsent({
        key,
        sourceEntityTag: "stale-etag",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(storage.head({ key, scope: "public" })).resolves.toBeNull();
  });

  it("preserves a provider failure while checking a conflicted publication", async () => {
    const storage = createR2ObjectStorage(config, client);
    client.failNext = Object.assign(new Error("precondition"), {
      $metadata: { httpStatusCode: 412 },
      name: "PreconditionFailed",
    });
    const originalHead = client.head.bind(client);
    client.head = async (input) => {
      client.failNext = new Error("metadata unavailable");
      return originalHead(input);
    };
    await expect(
      storage.copyPrivateToPublicIfAbsent({
        key,
        sourceEntityTag: "validated-etag",
      }),
    ).rejects.toMatchObject({ code: "provider-failure" });
  });

  it("returns null for missing metadata but rejects missing reads", async () => {
    const storage = createR2ObjectStorage(config, client);
    await expect(storage.head({ key, scope: "private" })).resolves.toBeNull();
    await expect(storage.read({ key, scope: "private" })).rejects.toMatchObject(
      {
        code: "not-found",
      },
    );
  });

  it("does not disguise provider metadata failures as missing objects", async () => {
    const storage = createR2ObjectStorage(config, client);
    client.failNext = new Error("metadata unavailable");
    await expect(storage.head({ key, scope: "private" })).rejects.toMatchObject(
      { code: "provider-failure" },
    );
  });

  it("deletes only the selected bucket and translates provider failures", async () => {
    const storage = createR2ObjectStorage(config, client);
    client.failNext = new Error("network unavailable");
    await expect(
      storage.delete({ key, scope: "public" }),
    ).rejects.toBeInstanceOf(ObjectStorageError);
    await expect(
      storage.delete({ key, scope: "private" }),
    ).resolves.toBeUndefined();
    expect(client.calls).toEqual([`delete:private-assets:${key}`]);
  });
});

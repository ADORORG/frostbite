import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createR2ObjectStorage } from "../src/create-adapter.ts";
import { config, key } from "./support/adapter-fixtures.ts";
import { FakeR2Client } from "./support/fake-r2-client.ts";

describe("R2 object-storage adapter presigning", () => {
  let client: FakeR2Client;

  beforeEach(() => {
    client = new FakeR2Client();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("binds private presigning to the key, type, length, and expiration", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-13T00:00:00Z"));
    const storage = createR2ObjectStorage(config, client);
    await expect(
      storage.presignPrivateUpload({
        contentLength: 5,
        contentType: "image/png",
        expiresInSeconds: 60,
        key,
      }),
    ).resolves.toMatchObject({
      expiresAt: new Date("2026-09-13T00:01:00Z"),
      headers: { "content-length": "5", "content-type": "image/png" },
      method: "PUT",
      url: new URL(client.signedUrl),
    });
    expect(client.calls).toContain(
      `presign:private-assets:${key}:image/png:5:60`,
    );
  });

  it("signs reads of the private bucket only, for the exact key and lifetime", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-13T00:00:00Z"));
    const storage = createR2ObjectStorage(config, client);
    await expect(
      storage.presignPrivateRead({ expiresInSeconds: 300, key }),
    ).resolves.toEqual({
      expiresAt: new Date("2026-09-13T00:05:00Z"),
      url: new URL(client.signedUrl),
    });
    expect(client.calls).toContain(`presign-get:private-assets:${key}:300`);
  });

  it("does not overstate read expiry when signing is delayed", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-13T00:00:00Z"));
    const original = client.presignGet.bind(client);
    client.presignGet = async (input) => {
      vi.setSystemTime(new Date("2026-09-13T00:00:30Z"));
      return original(input);
    };
    const storage = createR2ObjectStorage(config, client);
    const read = await storage.presignPrivateRead({
      expiresInSeconds: 60,
      key,
    });
    expect(read.expiresAt).toEqual(new Date("2026-09-13T00:01:00Z"));
  });

  it.each([0, -1, 1.5, 604_801, Number.NaN])(
    "rejects a read lifetime of %s before contacting the provider",
    async (expiresInSeconds) => {
      const storage = createR2ObjectStorage(config, client);
      await expect(
        storage.presignPrivateRead({ expiresInSeconds, key }),
      ).rejects.toThrow();
      expect(client.calls).toEqual([]);
    },
  );

  it("maps provider failures and refuses an untrusted signed read URL", async () => {
    const storage = createR2ObjectStorage(config, client);
    client.failNext = new Error("down");
    await expect(
      storage.presignPrivateRead({ expiresInSeconds: 60, key }),
    ).rejects.toMatchObject({ code: "provider-failure" });
    client.signedUrl = "http://insecure.example.invalid/read";
    await expect(
      storage.presignPrivateRead({ expiresInSeconds: 60, key }),
    ).rejects.toMatchObject({ code: "invalid-provider-response" });
  });

  it("does not overstate expiry when provider signing is delayed", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-13T00:00:00Z"));
    const originalPresign = client.presignPut.bind(client);
    client.presignPut = async (input) => {
      vi.setSystemTime(new Date("2026-09-13T00:00:30Z"));
      return originalPresign(input);
    };
    const storage = createR2ObjectStorage(config, client);
    const upload = await storage.presignPrivateUpload({
      contentLength: 5,
      contentType: "image/png",
      expiresInSeconds: 60,
      key,
    });
    expect(upload.expiresAt).toEqual(new Date("2026-09-13T00:01:00Z"));
  });

  it("rejects invalid transfer constraints before contacting the provider", async () => {
    const storage = createR2ObjectStorage(config, client);
    await expect(
      storage.presignPrivateUpload({
        contentLength: -1,
        contentType: "not a media type",
        expiresInSeconds: 604_801,
        key,
      }),
    ).rejects.toThrow();
    expect(client.calls).toEqual([]);
  });

  it("accepts a plain-http signed URL only from the configured loopback endpoint", async () => {
    const local = { ...config, endpoint: "http://127.0.0.1:9000" };
    const storage = createR2ObjectStorage(local, client);
    const request = {
      contentLength: 5,
      contentType: "image/png",
      expiresInSeconds: 60,
      key,
    };
    client.signedUrl = "http://127.0.0.1:9000/private-assets/a.png?sig=1";
    expect((await storage.presignPrivateUpload(request)).url.origin).toBe(
      "http://127.0.0.1:9000",
    );
    for (const url of [
      "http://127.0.0.1:9001/private-assets/a.png",
      "http://localhost:9000/private-assets/a.png",
      "http://insecure.example.invalid/upload",
    ]) {
      client.signedUrl = url;
      await expect(storage.presignPrivateUpload(request)).rejects.toMatchObject(
        {
          code: "invalid-provider-response",
        },
      );
    }
  });
});

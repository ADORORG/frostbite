import { describe, expect, it } from "vitest";

import { parseR2Environment, r2ConfigSchema } from "../src/config.ts";
import { createR2Client } from "../src/r2-client.ts";

const valid = {
  accessKeyId: "access",
  endpoint: "https://account.r2.cloudflarestorage.com",
  environment: "test" as const,
  privateBucket: "private-assets",
  publicBucket: "public-assets",
  region: "auto",
  secretAccessKey: "secret",
};

describe("R2 configuration", () => {
  it("parses the server environment into owned configuration", () => {
    expect(
      parseR2Environment({
        APP_ENV: valid.environment,
        R2_ACCESS_KEY_ID: valid.accessKeyId,
        R2_ENDPOINT: valid.endpoint,
        R2_PRIVATE_BUCKET: valid.privateBucket,
        R2_PUBLIC_BUCKET: valid.publicBucket,
        R2_REGION: valid.region,
        R2_SECRET_ACCESS_KEY: valid.secretAccessKey,
      }),
    ).toEqual(valid);
  });

  it.each([
    { ...valid, endpoint: "http://insecure.example.invalid" },
    { ...valid, endpoint: "http://127.0.0.1.example.invalid" },
    {
      ...valid,
      endpoint: "http://127.0.0.1:9000",
      environment: "production" as const,
    },
    {
      ...valid,
      endpoint: "http://localhost:9000",
      environment: "preview" as const,
    },
    { ...valid, endpoint: "ftp://127.0.0.1" },
    { ...valid, publicBucket: valid.privateBucket },
    { ...valid, privateBucket: "Bad_Name" },
    { ...valid, privateBucket: "Bad-name" },
    { ...valid, privateBucket: "bad.name" },
    { ...valid, privateBucket: "-bad-name" },
  ])("rejects insecure or contradictory configuration", (input) => {
    expect(() => r2ConfigSchema.parse(input)).toThrow();
  });

  it.each(["http://127.0.0.1:9000", "http://localhost:9000"])(
    "accepts plain http to this machine outside hosted environments (%s)",
    (endpoint) => {
      expect(r2ConfigSchema.parse({ ...valid, endpoint }).endpoint).toBe(
        endpoint,
      );
    },
  );

  it("requires a known runtime environment", () => {
    expect(() =>
      r2ConfigSchema.parse({ ...valid, environment: undefined }),
    ).toThrow();
    expect(() =>
      r2ConfigSchema.parse({ ...valid, environment: "staging" }),
    ).toThrow();
  });

  it("addresses buckets by path on a loopback endpoint and by host on https", async () => {
    const presign = async (endpoint: string) =>
      new URL(
        await createR2Client({ ...valid, endpoint }).presignPut({
          bucket: "private-assets",
          contentLength: 1,
          contentType: "image/png",
          expiresInSeconds: 60,
          key: "a/b.png",
        }),
      );
    // `localhost` is a DNS name, so only an explicit path-style setting avoids `bucket.localhost`.
    for (const host of ["localhost:9000", "127.0.0.1:9000"]) {
      const url = await presign(`http://${host}`);
      expect([url.host, url.pathname]).toEqual([
        host,
        "/private-assets/a/b.png",
      ]);
    }
    const hosted = await presign("https://account.r2.cloudflarestorage.com");
    expect([hosted.host, hosted.pathname]).toEqual([
      "private-assets.account.r2.cloudflarestorage.com",
      "/a/b.png",
    ]);
  });

  it("constructs the production SDK client without making a provider request", () => {
    expect(createR2Client(valid)).toMatchObject({
      copyIfAbsent: expect.any(Function),
      presignPut: expect.any(Function),
      put: expect.any(Function),
    });
  });
});

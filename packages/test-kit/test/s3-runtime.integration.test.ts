import { spawnSync } from "node:child_process";

import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startS3Runtime, type S3Runtime } from "../src/s3-runtime.ts";

const origin = "http://app.example.test";
let runtime: S3Runtime;
let client: S3Client;

const containers = () =>
  spawnSync(
    "docker",
    ["ps", "-a", "--filter", "name=frostbite-s3-", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  )
    .stdout.split("\n")
    .filter(Boolean);

beforeAll(async () => {
  runtime = await startS3Runtime({
    buckets: ["drafts", "public"],
    corsOrigins: [origin],
  });
  client = new S3Client({
    credentials: {
      accessKeyId: runtime.accessKeyId,
      secretAccessKey: runtime.secretAccessKey,
    },
    endpoint: runtime.endpoint,
    forcePathStyle: true,
    region: "us-east-1",
  });
}, 120_000);

afterAll(async () => {
  client?.destroy();
  await runtime?.stop();
});

describe("the disposable S3 runtime", () => {
  it("listens on loopback http, creates the buckets, and exposes its logs", async () => {
    expect(runtime.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    await client.send(new HeadBucketCommand({ Bucket: "drafts" }));
    await client.send(new HeadBucketCommand({ Bucket: "public" }));
    expect(await runtime.logs()).toContain("S3 read filer buckets dir");
  });

  it("answers a browser preflight for a presigned upload from the allowed origin only", async () => {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: "drafts",
        ContentType: "image/png",
        Key: "a.png",
      }),
      { expiresIn: 60 },
    );
    const preflight = (from: string) =>
      fetch(url, {
        headers: {
          "access-control-request-headers": "content-type",
          "access-control-request-method": "PUT",
          origin: from,
        },
        method: "OPTIONS",
      });
    const allowed = await preflight(origin);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(origin);
    expect(allowed.headers.get("access-control-allow-methods")).toContain(
      "PUT",
    );
    const denied = await preflight("http://evil.example.test");
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("removes its container on stop, and stopping twice is harmless", async () => {
    const extra = await startS3Runtime({ buckets: [] });
    const during = containers().length;
    await extra.stop();
    await extra.stop();
    expect(containers().length).toBe(during - 1);
  }, 120_000);

  it("fails and leaves no container behind when the image cannot start", async () => {
    const before = containers().length;
    await expect(
      startS3Runtime({ buckets: [], image: "frostbite-test/does-not-exist:0" }),
    ).rejects.toThrow("docker exited with code");
    expect(containers().length).toBe(before);
  }, 120_000);
});

import { Readable } from "node:stream";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "vitest";

import { createR2Client } from "../src/r2-client.ts";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required by the S3 conformance harness.`);
  return value;
}

const endpoint = requiredEnvironment("S3_TEST_ENDPOINT");
const credentials = {
  accessKeyId: requiredEnvironment("S3_TEST_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnvironment("S3_TEST_SECRET_ACCESS_KEY"),
};
const bucket = "ador-conformance";
const key = "nested/asset.txt";
const sdk = new S3Client({
  credentials,
  endpoint,
  forcePathStyle: true,
  region: "us-east-1",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const client = createR2Client(
  {
    ...credentials,
    endpoint,
    environment: "test",
    privateBucket: bucket,
    publicBucket: "ador-conformance-public",
    region: "us-east-1",
  },
  sdk,
);

beforeAll(async () => {
  await sdk.send(new CreateBucketCommand({ Bucket: bucket }));
});

describe("local S3-compatible service conformance", () => {
  it("round-trips streamed writes, metadata, reads, conditional conflicts, and deletion", async () => {
    await client.put({
      body: Readable.from(["asset"]),
      bucket,
      contentLength: 5,
      contentType: "text/plain",
      ifAbsent: true,
      key,
    });
    await expect(client.head({ bucket, key })).resolves.toMatchObject({
      ContentLength: 5,
      ContentType: "text/plain",
    });
    const object = await client.get({ bucket, key });
    if (!(object.Body instanceof Readable))
      throw new Error("Expected a Node readable stream.");
    const chunks: Buffer[] = [];
    for await (const chunk of object.Body) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("asset");
    await expect(
      client.put({
        body: Readable.from(["other"]),
        bucket,
        contentLength: 5,
        contentType: "text/plain",
        ifAbsent: true,
        key,
      }),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } });
    await client.delete({ bucket, key });
    await expect(client.head({ bucket, key })).rejects.toMatchObject({
      $metadata: { httpStatusCode: 404 },
    });
  });

  it("presigns the exact key without contacting the service", async () => {
    const signed = new URL(
      await client.presignPut({
        bucket,
        contentLength: 5,
        contentType: "text/plain",
        expiresInSeconds: 60,
        key,
      }),
    );
    expect(signed.pathname).toBe(`/${bucket}/${key}`);
    expect(signed.searchParams.get("X-Amz-Expires")).toBe("60");
  });
});

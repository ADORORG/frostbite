import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeAll, describe, expect, it } from "vitest";

import { createR2Client } from "../src/r2-client.ts";
import { s3Environment } from "./support/s3-environment.ts";

const { endpoint, ...credentials } = s3Environment;
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

  it("uploads through a presigned PUT and reads through a presigned GET, and refuses misuse", async () => {
    const objectKey = "presigned/round-trip.txt";
    const put = await client.presignPut({
      bucket,
      contentLength: 5,
      contentType: "text/plain",
      expiresInSeconds: 60,
      key: objectKey,
    });
    const upload = await fetch(put, {
      body: "asset",
      headers: { "content-type": "text/plain" },
      method: "PUT",
    });
    expect(upload.status).toBe(200);
    const get = (key: string, expiresInSeconds = 60) =>
      client.presignGet({ bucket, expiresInSeconds, key });

    const read = await fetch(await get(objectKey));
    expect([read.status, await read.text()]).toEqual([200, "asset"]);

    const other = new URL(await get(objectKey));
    other.pathname = `/${bucket}/presigned/other.txt`;
    expect((await fetch(other)).status).toBe(403);

    const upload2 = await fetch(put, {
      body: "tampered-length",
      headers: { "content-type": "text/plain" },
      method: "PUT",
    });
    expect(upload2.status).not.toBe(200);

    const shortLived = await get(objectKey, 1);
    await delay(2_100);
    expect((await fetch(shortLived)).status).toBe(403);
  });
});

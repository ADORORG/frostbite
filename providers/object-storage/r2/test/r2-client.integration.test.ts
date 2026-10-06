import { Readable } from "node:stream";

import { S3Client } from "@aws-sdk/client-s3";
import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { describe, expect, it } from "vitest";

import { createR2Client } from "../src/r2-client.ts";

const config = {
  accessKeyId: "access-key",
  endpoint: "https://storage.example.invalid",
  environment: "test" as const,
  privateBucket: "private-assets",
  publicBucket: "public-assets",
  region: "auto",
  secretAccessKey: "secret-key",
};

class RecordingHandler {
  readonly requests: HttpRequest[] = [];

  async handle(request: HttpRequest): Promise<{ response: HttpResponse }> {
    this.requests.push(request);
    const isGet = request.method === "GET";
    const isCopy = request.headers["x-amz-copy-source"] !== undefined;
    return {
      response: new HttpResponse({
        body: isGet
          ? Readable.from(["asset"])
          : isCopy
            ? Readable.from([
                "<CopyObjectResult><ETag>&quot;etag&quot;</ETag><LastModified>1970-01-01T00:00:01.000Z</LastModified></CopyObjectResult>",
              ])
            : undefined,
        headers: {
          "content-length": "5",
          "content-type": "image/png",
          date: "Thu, 01 Jan 1970 00:00:01 GMT",
          etag: '"etag"',
        },
        statusCode: 200,
      }),
    };
  }
}

function setup() {
  const handler = new RecordingHandler();
  const sdk = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    region: config.region,
    requestHandler: handler,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client: createR2Client(config, sdk), handler };
}

describe("R2 S3 protocol client", () => {
  it("serializes streamed put, head, get, and delete requests", async () => {
    const { client, handler } = setup();
    await client.put({
      body: Readable.from(["asset"]),
      bucket: config.privateBucket,
      contentLength: 5,
      contentType: "image/png",
      ifAbsent: true,
      key: "nested/art.png",
    });
    const head = await client.head({
      bucket: config.privateBucket,
      key: "nested/art.png",
    });
    const object = await client.get({
      bucket: config.privateBucket,
      key: "nested/art.png",
    });
    await client.delete({
      bucket: config.privateBucket,
      key: "nested/art.png",
    });

    expect(head).toMatchObject({
      ContentLength: 5,
      ContentType: "image/png",
      ETag: '"etag"',
    });
    expect(object.Body).toBeInstanceOf(Readable);
    expect(
      handler.requests.map(({ hostname, method, path }) => [
        method,
        hostname,
        path,
      ]),
    ).toEqual([
      ["PUT", "private-assets.storage.example.invalid", "/nested/art.png"],
      ["HEAD", "private-assets.storage.example.invalid", "/nested/art.png"],
      ["GET", "private-assets.storage.example.invalid", "/nested/art.png"],
      ["DELETE", "private-assets.storage.example.invalid", "/nested/art.png"],
    ]);
    expect(handler.requests[0]?.headers["if-none-match"]).toBe("*");
    expect(handler.requests[0]?.headers["content-length"]).toBe("5");
  });

  it("adds R2's atomic destination condition and encodes the copy source", async () => {
    const { client, handler } = setup();
    await client.copyIfAbsent({
      destinationBucket: config.publicBucket,
      key: "nested/art work.png",
      sourceBucket: config.privateBucket,
      sourceEntityTag: '"validated-etag"',
    });
    expect(handler.requests[0]).toMatchObject({
      hostname: "public-assets.storage.example.invalid",
      method: "PUT",
      path: "/nested/art%20work.png",
    });
    expect(handler.requests[0]?.headers).toMatchObject({
      "cf-copy-destination-if-none-match": "*",
      "x-amz-copy-source": "private-assets/nested/art%20work.png",
      "x-amz-copy-source-if-match": '"validated-etag"',
    });
  });

  it("presigns one exact PUT with the requested expiry and signed headers", async () => {
    const { client, handler } = setup();
    const signed = new URL(
      await client.presignPut({
        bucket: config.privateBucket,
        contentLength: 5,
        contentType: "image/png",
        expiresInSeconds: 60,
        key: "nested/art.png",
      }),
    );
    expect(signed.hostname).toBe("private-assets.storage.example.invalid");
    expect(signed.pathname).toBe("/nested/art.png");
    expect(signed.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(signed.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-length",
    );
    expect(handler.requests).toHaveLength(0);
  });

  it("permits replacement only when the caller explicitly requests it", async () => {
    const { client, handler } = setup();
    await client.put({
      body: Readable.from(["asset"]),
      bucket: config.privateBucket,
      contentLength: 5,
      contentType: "image/png",
      ifAbsent: false,
      key: "art.png",
    });
    expect(handler.requests[0]?.headers["if-none-match"]).toBeUndefined();
  });
});

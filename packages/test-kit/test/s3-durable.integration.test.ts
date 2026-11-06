import { randomUUID } from "node:crypto";

import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import { findContainer, wipe } from "../src/durable-container.ts";
import { startDurableS3Runtime } from "../src/s3-durable.ts";

const id = randomUUID().slice(0, 8);
const container = `frostbite-test-s3-keep-${id}`;
const volume = `${container}-data`;
const secret = randomUUID();
const clientFor = (endpoint: string, accessKeyId: string) =>
  new S3Client({
    credentials: { accessKeyId, secretAccessKey: secret },
    endpoint,
    forcePathStyle: true,
    region: "us-east-1",
  });

describe("an object store that keeps its files between runs", () => {
  it("has the buckets and files of the earlier run when started again, is stopped and kept, and is gone once wiped", async () => {
    try {
      const first = await startDurableS3Runtime({
        buckets: ["kept"],
        container,
        secret,
        volume,
      });
      const writer = clientFor(first.endpoint, first.accessKeyId);
      await writer.send(
        new PutObjectCommand({
          Body: "still here",
          Bucket: "kept",
          Key: "note",
        }),
      );
      writer.destroy();
      await first.stop();
      expect(await findContainer(container)).toBe("stopped");

      // The same buckets asked for again are not an error, and the file is where it was left.
      const second = await startDurableS3Runtime({
        buckets: ["kept"],
        container,
        secret,
        volume,
      });
      const reader = clientFor(second.endpoint, second.accessKeyId);
      await reader.send(new HeadBucketCommand({ Bucket: "kept" }));
      const object = await reader.send(
        new GetObjectCommand({ Bucket: "kept", Key: "note" }),
      );
      expect(await object.Body?.transformToString()).toBe("still here");
      reader.destroy();
      await second.stop();
    } finally {
      await wipe({ containers: [container], volumes: [volume] });
    }
    expect(await findContainer(container)).toBe("missing");
  }, 180_000);
});

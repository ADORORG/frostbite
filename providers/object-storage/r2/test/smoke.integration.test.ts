import {
  CreateBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createR2ObjectStorage } from "../src/create-adapter.ts";
import { runStorageSmoke } from "../scripts/smoke-checks.ts";
import { s3Environment } from "./support/s3-environment.ts";
import { testWebOrigin } from "./support/s3-container.ts";

const { accessKeyId, endpoint, secretAccessKey } = s3Environment;
const config = {
  accessKeyId,
  endpoint,
  environment: "test" as const,
  privateBucket: "smoke-private",
  publicBucket: "smoke-public",
  region: "us-east-1",
  secretAccessKey,
};

const client = new S3Client({
  credentials: { accessKeyId, secretAccessKey },
  endpoint,
  forcePathStyle: true,
  region: "us-east-1",
});

async function leftovers(bucket: string): Promise<number> {
  const listing = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: "smoke/" }),
  );
  return listing.KeyCount ?? 0;
}

beforeAll(async () => {
  for (const Bucket of [config.privateBucket, config.publicBucket])
    await client.send(new CreateBucketCommand({ Bucket }));
});
afterAll(() => client.destroy());

describe("storage smoke checks", () => {
  it("pass against a standards-compliant service, in order, and leave nothing behind", async () => {
    const storage = createR2ObjectStorage(config);
    const results = await runStorageSmoke(storage, testWebOrigin);
    expect(results.map(({ name, ok }) => [name, ok])).toEqual([
      ["presign upload", true],
      ["browser CORS preflight for the upload", true],
      ["upload through the signed URL", true],
      ["head", true],
      ["read through a signed URL", true],
      ["streamed server read", true],
      ["conditional private-to-public copy (R2 extension)", true],
      ["delete, twice (cleanup relies on it)", true],
    ]);
    expect([
      await leftovers(config.privateBucket),
      await leftovers(config.publicBucket),
    ]).toEqual([0, 0]);
  });

  it("reports a missing CORS rule instead of passing it", async () => {
    const results = await runStorageSmoke(
      createR2ObjectStorage(config),
      "https://other.example.test",
    );
    const cors = results.find(({ name }) => name.includes("CORS"));
    expect(cors).toMatchObject({ ok: false });
    expect(cors?.detail).toContain("https://other.example.test");
  });

  it("reports failures per check without throwing, and still cleans up", async () => {
    const storage = createR2ObjectStorage({
      ...config,
      privateBucket: "no-such-bucket-here",
    });
    const results = await runStorageSmoke(storage, testWebOrigin);
    expect(results.some(({ ok }) => !ok)).toBe(true);
    expect(
      results.every(({ detail }) => !detail.includes(secretAccessKey)),
    ).toBe(true);
    expect(await leftovers(config.publicBucket)).toBe(0);
  });

  it("fails the delete check when deleting a key twice is refused", async () => {
    const storage = createR2ObjectStorage(config);
    let deletes = 0;
    const results = await runStorageSmoke(
      {
        ...storage,
        delete: (input) =>
          (deletes += 1) === 2
            ? Promise.reject(new Error("second delete refused"))
            : storage.delete(input),
      },
      testWebOrigin,
    );
    expect(
      results.find(({ name }) => name.startsWith("delete, twice")),
    ).toEqual({
      detail: "second delete refused",
      name: "delete, twice (cleanup relies on it)",
      ok: false,
    });
  });

  it("stops after a failed presign instead of reporting misleading follow-on failures", async () => {
    const storage = createR2ObjectStorage(config);
    const results = await runStorageSmoke(
      {
        ...storage,
        presignPrivateUpload: () => Promise.reject(new Error("no signer")),
      },
      testWebOrigin,
    );
    expect(results).toEqual([
      { detail: "no signer", name: "presign upload", ok: false },
    ]);
  });
});

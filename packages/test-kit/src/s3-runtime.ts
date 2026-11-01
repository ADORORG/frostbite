import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  containerLogs,
  freePort,
  guardContainer,
  runDocker,
} from "./docker.ts";

// The one pinned S3-compatible service used wherever the platform needs a local stand-in for R2: SeaweedFS, which is still published
// as a free image (MinIO's pinned image can no longer be pulled from any registry).
export const s3ImageReference =
  "chrislusf/seaweedfs:4.50@sha256:c2658820e763294a9e9de7b36c81e59b879e3459148351aee4e31a126ca64860";

export const accessKeyId = "ador-local-access";
const readyAttempts = 60;
const readyPollMs = 500;
export const s3ContainerPort = 8333;

// What `docker run` is given to start the service with these credentials, a data folder at /data and the browser origins that may call
// it. One place, so the disposable and the durable runtimes cannot drift apart.
export function s3ContainerSettings(input: {
  readonly corsOrigins?: readonly string[];
  readonly secretAccessKey: string;
}): {
  readonly command: readonly string[];
  readonly environment: readonly string[];
} {
  return {
    command: [
      "server",
      "-s3",
      "-dir=/data",
      "-ip.bind=0.0.0.0",
      // R2 answers an upload to a bucket that does not exist with an error; SeaweedFS would make the bucket for an admin identity.
      "-s3.autoCreateBucket=false",
      ...(input.corsOrigins === undefined
        ? []
        : [`-s3.allowedOrigins=${input.corsOrigins.join(",")}`]),
    ],
    environment: [
      "--env",
      `AWS_ACCESS_KEY_ID=${accessKeyId}`,
      "--env",
      `AWS_SECRET_ACCESS_KEY=${input.secretAccessKey}`,
    ],
  };
}

export interface S3Runtime {
  readonly accessKeyId: string;
  readonly endpoint: string;
  logs(): Promise<string>;
  readonly secretAccessKey: string;
  stop(): Promise<void>;
}

export async function waitUntilReady(endpoint: string): Promise<void> {
  for (let attempt = 0; attempt < readyAttempts; attempt += 1) {
    try {
      if ((await fetch(`${endpoint}/healthz`)).ok) return;
    } catch {
      // The service may not have bound its port yet.
    }
    await delay(readyPollMs);
  }
  throw new Error("S3 runtime did not become ready.");
}

// The bucket made, written to and removed again to wake the store (see `prepareStore`).
const warmUpBucket = "ador-warm-up";

// Gets a store ready to use: makes the buckets that are not there yet (a store that kept its data from an earlier run already has them),
// once it can take a write. SeaweedFS makes space for its first write only about 14 seconds after it starts (its master waits before it
// hands out volume ids; every write after that takes milliseconds), so the first write is made here, in a bucket that is removed again,
// rather than by whichever test writes first, which would time out waiting.
export async function prepareStore(
  client: S3Client,
  buckets: readonly string[],
): Promise<void> {
  await ensureBucket(client, warmUpBucket);
  await client.send(
    new PutObjectCommand({ Body: "warm", Bucket: warmUpBucket, Key: "warm" }),
  );
  await client.send(
    new DeleteObjectCommand({ Bucket: warmUpBucket, Key: "warm" }),
  );
  await client.send(new DeleteBucketCommand({ Bucket: warmUpBucket }));
  for (const Bucket of buckets) await ensureBucket(client, Bucket);
}

async function ensureBucket(client: S3Client, Bucket: string): Promise<void> {
  try {
    await client.send(new CreateBucketCommand({ Bucket }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "BucketAlreadyOwnedByYou")
      throw error;
  }
}

// Starts a disposable S3-compatible service on a loopback port and creates the named buckets.
// `corsOrigins` are the browser origins allowed to call it directly (presigned uploads are made by
// the browser, not the server). Credentials are random per run; the endpoint is plain http on
// loopback, which the R2 configuration accepts only outside hosted environments.
export async function startS3Runtime(input: {
  readonly buckets: readonly string[];
  readonly corsOrigins?: readonly string[];
  readonly hostPort?: number;
  readonly image?: string;
  readonly terminate?: (signal: NodeJS.Signals) => void;
}): Promise<S3Runtime> {
  const containerName = `ador-s3-${randomUUID()}`;
  const secretAccessKey = randomUUID();
  const hostPort = input.hostPort ?? (await freePort());
  const endpoint = `http://127.0.0.1:${hostPort}`;
  const guard = guardContainer(containerName, input.terminate);
  try {
    const settings = s3ContainerSettings({
      corsOrigins: input.corsOrigins,
      secretAccessKey,
    });
    await runDocker([
      "run",
      "--detach",
      "--name",
      containerName,
      ...settings.environment,
      "--publish",
      `127.0.0.1:${hostPort}:${s3ContainerPort}`,
      input.image ?? s3ImageReference,
      ...settings.command,
    ]);
    guard.markStarted();
    await waitUntilReady(endpoint);
    const client = new S3Client({
      credentials: { accessKeyId, secretAccessKey },
      endpoint,
      forcePathStyle: true,
      region: "us-east-1",
    });
    await prepareStore(client, input.buckets);
    client.destroy();
    return {
      accessKeyId,
      endpoint,
      logs: () => containerLogs(containerName),
      secretAccessKey,
      stop: guard.stop,
    };
  } catch (error) {
    await guard.stop();
    throw error;
  }
}

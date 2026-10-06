import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

import {
  containerLogs,
  freePort,
  guardContainer,
  runDocker,
} from "./docker.ts";

// The one pinned S3-compatible service used wherever the platform needs a local stand-in for R2.
export const s3ImageReference =
  "quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e";

const accessKeyId = "ador-local-access";
const readyAttempts = 60;
const readyPollMs = 500;
const containerPort = 9000;

export interface S3Runtime {
  readonly accessKeyId: string;
  readonly endpoint: string;
  logs(): Promise<string>;
  readonly secretAccessKey: string;
  stop(): Promise<void>;
}

async function waitUntilReady(endpoint: string): Promise<void> {
  for (let attempt = 0; attempt < readyAttempts; attempt += 1) {
    try {
      if ((await fetch(`${endpoint}/minio/health/ready`)).ok) return;
    } catch {
      // The service may not have bound its port yet.
    }
    await delay(readyPollMs);
  }
  throw new Error("S3 runtime did not become ready.");
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
    await runDocker([
      "run",
      "--detach",
      "--name",
      containerName,
      "--env",
      `MINIO_ROOT_USER=${accessKeyId}`,
      "--env",
      `MINIO_ROOT_PASSWORD=${secretAccessKey}`,
      ...(input.corsOrigins === undefined
        ? []
        : [
            "--env",
            `MINIO_API_CORS_ALLOW_ORIGIN=${input.corsOrigins.join(",")}`,
          ]),
      "--publish",
      `127.0.0.1:${hostPort}:${containerPort}`,
      input.image ?? s3ImageReference,
      "server",
      "/data",
    ]);
    guard.markStarted();
    await waitUntilReady(endpoint);
    const client = new S3Client({
      credentials: { accessKeyId, secretAccessKey },
      endpoint,
      forcePathStyle: true,
      region: "us-east-1",
    });
    for (const Bucket of input.buckets)
      await client.send(new CreateBucketCommand({ Bucket }));
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

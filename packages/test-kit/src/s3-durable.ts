import { S3Client } from "@aws-sdk/client-s3";

import { runDocker } from "./docker.ts";
import {
  ensureRunning,
  stopKeeping,
  type Docker,
} from "./durable-container.ts";
import {
  accessKeyId,
  createBuckets,
  s3ImageReference,
  waitUntilReady,
  type S3Runtime,
} from "./s3-runtime.ts";

const containerPort = 9000;

// The S3-compatible store of a stack that keeps its data: a named container with its objects in a named volume, started again (not
// made new) on the next run, and only stopped, never removed, when the run ends. The secret must be the one it was first made with.
export async function startDurableS3Runtime(input: {
  readonly buckets: readonly string[];
  readonly container: string;
  readonly corsOrigins?: readonly string[];
  readonly docker?: Docker;
  readonly image?: string;
  readonly secret: string;
  readonly volume: string;
}): Promise<S3Runtime> {
  const docker = input.docker ?? runDocker;
  await ensureRunning(
    {
      create: [
        "run",
        "--detach",
        "--name",
        input.container,
        "--env",
        `MINIO_ROOT_USER=${accessKeyId}`,
        "--env",
        `MINIO_ROOT_PASSWORD=${input.secret}`,
        ...(input.corsOrigins === undefined
          ? []
          : [
              "--env",
              `MINIO_API_CORS_ALLOW_ORIGIN=${input.corsOrigins.join(",")}`,
            ]),
        "--volume",
        `${input.volume}:/data`,
        "--publish",
        `127.0.0.1::${String(containerPort)}`,
        input.image ?? s3ImageReference,
        "server",
        "/data",
      ],
      name: input.container,
    },
    docker,
  );
  // The port Docker gave it, read back each time: it is not the same after a restart.
  const mapping = await docker([
    "port",
    input.container,
    `${String(containerPort)}/tcp`,
  ]);
  const endpoint = `http://127.0.0.1:${mapping.slice(mapping.lastIndexOf(":") + 1)}`;
  try {
    await waitUntilReady(endpoint);
    const client = new S3Client({
      credentials: { accessKeyId, secretAccessKey: input.secret },
      endpoint,
      forcePathStyle: true,
      region: "us-east-1",
    });
    await createBuckets(client, input.buckets);
    client.destroy();
  } catch (error) {
    await stopKeeping(input.container, docker);
    throw error;
  }
  return {
    accessKeyId,
    endpoint,
    logs: () => docker(["logs", input.container]),
    secretAccessKey: input.secret,
    stop: () => stopKeeping(input.container, docker),
  };
}

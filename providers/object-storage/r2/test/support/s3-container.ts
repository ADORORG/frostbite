import { startS3Runtime } from "@ador/test-kit/s3-runtime";

export interface S3TestEnvironment {
  readonly accessKeyId: string;
  readonly endpoint: string;
  readonly secretAccessKey: string;
}

// The conformance suite creates its own buckets, so the runtime starts without any.
export async function withDisposableS3(
  callback: (environment: S3TestEnvironment) => Promise<void>,
): Promise<void> {
  const runtime = await startS3Runtime({ buckets: [] });
  try {
    await callback(runtime);
  } finally {
    await runtime.stop();
  }
}

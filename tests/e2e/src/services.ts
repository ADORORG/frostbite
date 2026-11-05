import {
  freePort,
  startInngestRuntime,
  type InngestRuntime,
} from "@frostbite/test-kit/inngest-runtime";
import { startS3Runtime, type S3Runtime } from "@frostbite/test-kit/s3-runtime";
import {
  startServiceProcess,
  type ServiceProcess,
} from "@frostbite/test-kit/service-process";

// Names of the two buckets the browser flows use. Fixed because nothing outside the run reads them.
const privateBucket = "e2e-private-drafts";
const publicBucket = "e2e-public-assets";
const workerEntry = "src/main.ts";
const workerCwd = new URL("../../../apps/worker/", import.meta.url);
// The Inngest server requires hex keys of an even length.
const eventKey = "e2e0123456789abcdef0123456789abcd";
const signingKey = "ab".repeat(32);

// The real service launchers; tests substitute fakes to check ordering and cleanup.
export interface ServiceLaunchers {
  freePort: typeof freePort;
  startInngestRuntime: typeof startInngestRuntime;
  startS3Runtime: typeof startS3Runtime;
  startServiceProcess: typeof startServiceProcess;
}

const realLaunchers: ServiceLaunchers = {
  freePort,
  startInngestRuntime,
  startS3Runtime,
  startServiceProcess,
};

// Environment shared by the web server and the worker so both reach the same storage.
export function storageEnvironment(
  runtime: Pick<S3Runtime, "accessKeyId" | "endpoint" | "secretAccessKey">,
): NodeJS.ProcessEnv {
  return {
    R2_ACCESS_KEY_ID: runtime.accessKeyId,
    R2_ENDPOINT: runtime.endpoint,
    R2_PRIVATE_BUCKET: privateBucket,
    R2_PUBLIC_BUCKET: publicBucket,
    R2_REGION: "us-east-1",
    R2_SECRET_ACCESS_KEY: runtime.secretAccessKey,
  };
}

export function inngestEnvironment(hostPort: number): NodeJS.ProcessEnv {
  return {
    INNGEST_APP_ID: "frostbit-e2e",
    INNGEST_BASE_URL: `http://127.0.0.1:${hostPort}`,
    // Signature verification stays on: the flow exercises the signed endpoint like production.
    INNGEST_DEV: "false",
    INNGEST_EVENT_KEY: eventKey,
    INNGEST_SIGNING_KEY: signingKey,
  };
}

// Starts the real supporting services the upload flows depend on, in the order they need: local S3
// (with CORS for the web origin, because the browser uploads straight to it), the worker (endpoint
// and outbox relay), then a self-hosted Inngest that syncs the worker. Everything is stopped, in
// reverse, when the callback finishes or fails. The callback receives the environment the web
// server needs.
export async function withUploadServices(
  input: {
    readonly baseEnvironment: NodeJS.ProcessEnv;
    readonly launchers?: ServiceLaunchers;
    // Where the object storage comes from, when it is not the disposable one a test run starts (the local stack keeps its own).
    readonly startStorage?: (settings: {
      readonly buckets: readonly string[];
      readonly corsOrigins: readonly string[];
    }) => Promise<S3Runtime>;
    readonly webOrigin: string;
  },
  callback: (environment: NodeJS.ProcessEnv) => Promise<void>,
): Promise<void> {
  // Only the end-to-end run uses the real launchers (Docker and child processes); unit tests inject
  // fakes, so this default is the one branch they cannot cover.
  const launch = input.launchers ?? realLaunchers;
  const stops: (() => Promise<void>)[] = [];
  const failures: Error[] = [];
  const record = (error: unknown) =>
    failures.push(error instanceof Error ? error : new Error(String(error)));
  try {
    const storageSettings = {
      buckets: [privateBucket, publicBucket],
      corsOrigins: [input.webOrigin],
    };
    const storage: S3Runtime = await (
      input.startStorage ?? launch.startS3Runtime
    )(storageSettings);
    stops.push(storage.stop);
    const workerPort = await launch.freePort();
    const inngestPort = await launch.freePort();
    const serviceEnvironment = {
      ...storageEnvironment(storage),
      ...inngestEnvironment(inngestPort),
    };
    const worker: ServiceProcess = await launch.startServiceProcess({
      cwd: workerCwd,
      entry: workerEntry,
      env: {
        ...process.env,
        ...input.baseEnvironment,
        ...serviceEnvironment,
        PORT: String(workerPort),
      },
      readyLine: "worker listening",
    });
    stops.push(async () => void (await worker.stop()));
    const inngest: InngestRuntime = await launch.startInngestRuntime({
      appPort: workerPort,
      eventKey,
      hostPort: inngestPort,
      retryIntervalSeconds: 1,
      signingKey,
    });
    stops.push(inngest.stop);
    await callback(serviceEnvironment);
  } catch (error) {
    record(error);
  }
  // One service failing to stop must not leave the others (a container, for one) running. The first
  // failure, which is the cause when there is one, is the one reported.
  for (const stop of stops.reverse()) await stop().catch(record);
  const [first] = failures;
  if (first !== undefined) throw first;
}

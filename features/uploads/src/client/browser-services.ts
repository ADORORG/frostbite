import { idempotencyKeySchema, type IdempotencyKey } from "@ador/shared/http";

import { sameOriginFetch } from "@ador/client-http";

import { createUploadsApi, type UploadsApi } from "./api-client.ts";
import {
  resolveUploadClientPolicy,
  type UploadClientPolicy,
} from "./client-policy.ts";
import { createXhrTransfer, type ObjectTransfer } from "./transfer.ts";
import {
  createUploadRunner,
  type UploadRunnerDependencies,
} from "./upload-runner.ts";

// Everything the browser UI needs from its environment, in one injectable bundle. Components and
// hooks receive this instead of reaching for `fetch`, `XMLHttpRequest`, `crypto`, or timers, so the
// UI is testable without a browser network and replaceable without touching components.
export interface UploadsClientServices {
  readonly api: UploadsApi;
  createIdempotencyKey(): IdempotencyKey;
  now(): number;
  readonly policy: UploadClientPolicy;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
  readonly transfer: ObjectTransfer;
}

// Resolves after `milliseconds`, or rejects with the abort reason as soon as the signal aborts.
export function abortableSleep(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function createBrowserServices(
  overrides: Partial<UploadsClientServices> = {},
): UploadsClientServices {
  const policy = overrides.policy ?? resolveUploadClientPolicy();
  return {
    api: createUploadsApi(sameOriginFetch),
    createIdempotencyKey: () => idempotencyKeySchema.parse(crypto.randomUUID()),
    now: () => Date.now(),
    policy,
    sleep: abortableSleep,
    transfer: createXhrTransfer(undefined, {
      stallMs: policy.transferStallMs,
    }),
    ...overrides,
  };
}

// The runner for one set of services; every uploader builds it the same way. A batch passes a shared
// `watch` so its uploads ask the server about processing together.
export function runnerFor(
  services: UploadsClientServices,
  watch?: UploadRunnerDependencies["watch"],
) {
  return createUploadRunner({
    api: services.api,
    policy: services.policy,
    sleep: services.sleep,
    transfer: services.transfer,
    watch,
  });
}

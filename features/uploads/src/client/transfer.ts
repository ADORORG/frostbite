// Moves the file's bytes to the presigned storage URL. A port, because the browser's XMLHttpRequest
// is the only API that reports upload progress, and tests need to substitute it.
export interface ObjectTransfer {
  upload(input: {
    readonly body: Blob;
    readonly headers: Readonly<Record<string, string>>;
    readonly onProgress: (fraction: number) => void;
    readonly signal: AbortSignal;
    readonly url: string;
  }): Promise<void>;
}

export type TransferFailure = "aborted" | "network" | "rejected" | "stalled";

export class TransferError extends Error {
  readonly failure: TransferFailure;
  readonly status: number | null;

  constructor(failure: TransferFailure, status: number | null) {
    super(`Upload ${failure}${status === null ? "" : ` (${status})`}.`);
    this.name = "TransferError";
    this.failure = failure;
    this.status = status;
  }
}

// Headers a browser sets itself and refuses to let scripts set. The presigned URL binds the length
// and type; the browser derives the length from the Blob, so only the rest may be passed through.
const browserManagedHeaders: ReadonlySet<string> = new Set([
  "content-length",
  "host",
]);

export function scriptSettableHeaders(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !browserManagedHeaders.has(name.toLowerCase()),
    ),
  );
}

// The slice of XMLHttpRequest the transfer uses; the real object satisfies it structurally.
export interface TransferRequest {
  abort(): void;
  onabort: ((event: ProgressEvent) => void) | null;
  onerror: ((event: ProgressEvent) => void) | null;
  onload: ((event: ProgressEvent) => void) | null;
  open(method: string, url: string): void;
  send(body: Blob): void;
  setRequestHeader(name: string, value: string): void;
  readonly status: number;
  readonly upload: { onprogress: ((event: ProgressEvent) => void) | null };
}

export interface TransferTimers {
  // How long a send may go without a sign of progress before it is given up on.
  readonly stallMs: number;
  readonly clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  readonly setTimer?: (
    run: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
}

// A storage endpoint can accept the connection and then stop answering; without a limit the progress bar would stand still
// until the person cancelled. The limit is on silence, not on the whole send, so a big file on a slow line is not cut off
// while bytes are still moving: every progress event starts the wait again.
export function createXhrTransfer(
  createRequest: () => TransferRequest = () => new XMLHttpRequest(),
  timers?: TransferTimers,
): ObjectTransfer {
  const setTimer = timers?.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer = timers?.clearTimer ?? clearTimeout;
  return {
    upload: ({ body, headers, onProgress, signal, url }) =>
      new Promise<void>((resolve, reject) => {
        // Aborting a request that was never sent fires no event, so this case must settle here.
        if (signal.aborted) return reject(new TransferError("aborted", null));
        const request = createRequest();
        const abort = () => request.abort();
        signal.addEventListener("abort", abort, { once: true });
        let stalled = false;
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        const watch = () => {
          if (timers === undefined) return;
          if (watchdog !== undefined) clearTimer(watchdog);
          watchdog = setTimer(() => {
            stalled = true;
            request.abort();
          }, timers.stallMs);
        };
        const settle = (finish: () => void) => {
          signal.removeEventListener("abort", abort);
          if (watchdog !== undefined) clearTimer(watchdog);
          finish();
        };
        request.upload.onprogress = (event) => {
          watch();
          if (event.lengthComputable && event.total > 0)
            onProgress(event.loaded / event.total);
        };
        request.onload = () =>
          settle(() =>
            request.status >= 200 && request.status < 300
              ? resolve()
              : reject(new TransferError("rejected", request.status)),
          );
        request.onerror = () =>
          settle(() => reject(new TransferError("network", null)));
        request.onabort = () =>
          settle(() =>
            reject(new TransferError(stalled ? "stalled" : "aborted", null)),
          );
        request.open("PUT", url);
        for (const [name, value] of Object.entries(
          scriptSettableHeaders(headers),
        ))
          request.setRequestHeader(name, value);
        watch();
        request.send(body);
      }),
  };
}

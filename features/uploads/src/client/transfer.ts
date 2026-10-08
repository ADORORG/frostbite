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

export type TransferFailure = "aborted" | "network" | "rejected";

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

export function createXhrTransfer(
  createRequest: () => TransferRequest = () => new XMLHttpRequest(),
): ObjectTransfer {
  return {
    upload: ({ body, headers, onProgress, signal, url }) =>
      new Promise<void>((resolve, reject) => {
        // Aborting a request that was never sent fires no event, so this case must settle here.
        if (signal.aborted) return reject(new TransferError("aborted", null));
        const request = createRequest();
        const abort = () => request.abort();
        signal.addEventListener("abort", abort, { once: true });
        const settle = (finish: () => void) => {
          signal.removeEventListener("abort", abort);
          finish();
        };
        request.upload.onprogress = (event) => {
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
          settle(() => reject(new TransferError("aborted", null)));
        request.open("PUT", url);
        for (const [name, value] of Object.entries(
          scriptSettableHeaders(headers),
        ))
          request.setRequestHeader(name, value);
        request.send(body);
      }),
  };
}

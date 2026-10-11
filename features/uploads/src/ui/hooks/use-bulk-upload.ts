import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { defaultUploadPolicy, type UploadPurpose } from "@ador/shared/uploads";

import {
  bulkReducer,
  canRetry,
  initialBulkState,
  isBulkBusy,
  isSecuring,
  isWaiting,
  summarize,
  type BulkEntry,
  type BulkState,
  type BulkSummary,
} from "../../client/bulk-state.ts";
import { createAssetWatcher } from "../../client/asset-watcher.ts";
import {
  runnerFor,
  type UploadsClientServices,
} from "../../client/browser-services.ts";
import {
  checkFile,
  type CheckedFile,
  type FileRejection,
} from "../../client/file-checks.ts";
import { createUploadAttempt } from "../../client/upload-runner.ts";
import {
  isUploadBusy,
  type UploadAttempt,
  type UploadEvent,
} from "../../client/upload-state.ts";

export interface BulkUpload {
  // How many of the chosen files were left out because the batch was full.
  add(files: readonly File[]): { readonly skipped: number };
  readonly busy: boolean;
  cancel(): void;
  clear(): void;
  retry(id: string): void;
  retryAll(): void;
  readonly state: BulkState;
  readonly summary: BulkSummary;
}

interface Subject {
  assetId: string | null;
  // Set when the file is put back in line, so its next run keeps the key and what it already did.
  attempt: UploadAttempt | null;
  readonly checked: CheckedFile;
  controller: AbortController | null;
  readonly file: File;
}

// Many files of one purpose, sent a few at a time. The server allows only a few unfinished uploads per
// person, so the batch keeps that many in flight and starts the next as each is taken by the server;
// checking the images afterwards runs alongside. Every file has its own idempotency key and state, so
// one failure never stops the others.
export function useBulkUpload(
  services: UploadsClientServices,
  purpose: UploadPurpose,
  options: {
    readonly concurrency?: number;
    // Called with each image once it has been checked and processed, and never before.
    readonly onProcessed?: (assetId: string, fileName: string) => void;
  } = {},
): BulkUpload {
  const { concurrency = defaultUploadPolicy.activeIntentLimitPerUser } =
    options;
  const [state, dispatch] = useReducer(bulkReducer, initialBulkState);
  const stateRef = useRef(state);
  const subjects = useRef(new Map<string, Subject>());
  const inFlight = useRef(new Set<string>());
  const sequence = useRef(0);
  const onProcessedRef = useRef(options.onProcessed);
  const runner = useMemo(() => {
    const watcher = createAssetWatcher({
      api: services.api,
      policy: services.policy,
      sleep: services.sleep,
    });
    return runnerFor(services, watcher.watch);
  }, [services]);

  const start = useCallback(
    (id: string) => {
      const subject = subjects.current.get(id);
      if (subject === undefined || inFlight.current.has(id)) return;
      inFlight.current.add(id);
      const controller = new AbortController();
      subject.controller = controller;
      const attempt =
        subject.attempt ??
        createUploadAttempt({
          file: { name: subject.file.name, size: subject.file.size },
          idempotencyKey: services.createIdempotencyKey(),
          purpose,
        });
      subject.attempt = null;
      const emit = (event: UploadEvent) => {
        if (event.type === "completed") subject.assetId = event.assetId;
        dispatch({ event, id, type: "entry" });
        if (
          event.type === "finished" &&
          event.outcome === "processed" &&
          subject.assetId !== null
        )
          onProcessedRef.current?.(subject.assetId, subject.file.name);
      };
      emit({ attempt, type: "started" });
      runner({
        attempt,
        checked: subject.checked,
        emit,
        file: subject.file,
        signal: controller.signal,
      })
        // The runner reports every expected failure itself; reaching here means a defect.
        .catch(() =>
          emit({
            cause: { kind: "unexpected" },
            retryable: false,
            type: "failed",
          }),
        )
        .finally(() => inFlight.current.delete(id));
    },
    [purpose, runner, services],
  );

  useEffect(() => {
    stateRef.current = state;
    onProcessedRef.current = options.onProcessed;
  });

  // Fills the free slots with the files that wait, oldest first.
  useEffect(() => {
    let free = Math.min(
      concurrency - state.entries.filter(isSecuring).length,
      services.policy.bulkInFlightLimit -
        state.entries.filter(({ state: one }) => isUploadBusy(one)).length,
    );
    for (const entry of state.entries) {
      if (free <= 0) break;
      if (!isWaiting(entry) || inFlight.current.has(entry.id)) continue;
      start(entry.id);
      free -= 1;
    }
  }, [concurrency, services.policy.bulkInFlightLimit, start, state]);

  useEffect(
    () => () => {
      for (const subject of subjects.current.values())
        subject.controller?.abort();
    },
    [],
  );

  const requeue = (id: string) => {
    const entry = stateRef.current.entries.find((one) => one.id === id);
    const subject = subjects.current.get(id);
    if (
      entry === undefined ||
      subject === undefined ||
      !canRetry(entry.state) ||
      !("attempt" in entry.state)
    )
      return;
    subject.attempt = entry.state.attempt;
    dispatch({ id, type: "requeued" });
  };

  // Releases the files of entries that are leaving the list.
  const forget = (leaving: (entry: BulkEntry) => boolean) => {
    for (const entry of stateRef.current.entries)
      if (leaving(entry)) subjects.current.delete(entry.id);
  };

  return {
    add: (files) => {
      const room = Math.max(
        0,
        services.policy.bulkFileLimit - stateRef.current.entries.length,
      );
      const chosen = files.slice(0, room);
      const waiting: { id: string; name: string }[] = [];
      const refused: {
        id: string;
        name: string;
        rejection: FileRejection;
      }[] = [];
      for (const file of chosen) {
        sequence.current += 1;
        const id = String(sequence.current);
        const checked = checkFile(file, purpose);
        if (checked.ok) {
          subjects.current.set(id, {
            assetId: null,
            attempt: null,
            checked: checked.file,
            controller: null,
            file,
          });
          waiting.push({ id, name: file.name });
        } else {
          refused.push({ id, name: file.name, rejection: checked.rejection });
        }
      }
      dispatch({ refused, type: "added", waiting });
      return { skipped: files.length - chosen.length };
    },
    busy: isBulkBusy(state),
    cancel: () => {
      forget((entry) => isWaiting(entry));
      dispatch({ type: "dropped-waiting" });
      for (const subject of subjects.current.values())
        subject.controller?.abort();
    },
    clear: () => {
      forget((entry) => !isWaiting(entry) && !isUploadBusy(entry.state));
      dispatch({ type: "cleared" });
    },
    retry: requeue,
    retryAll: () => {
      for (const entry of stateRef.current.entries) requeue(entry.id);
    },
    state,
    summary: summarize(state),
  };
}

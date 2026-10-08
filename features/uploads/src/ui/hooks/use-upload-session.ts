import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { UploadPurpose } from "@ador/shared/uploads";

import type { UploadsClientServices } from "../../client/browser-services.ts";
import { checkFile, type CheckedFile } from "../../client/file-checks.ts";
import {
  createUploadAttempt,
  createUploadRunner,
} from "../../client/upload-runner.ts";
import {
  initialUploadState,
  isUploadBusy,
  uploadReducer,
  type UploadAttempt,
  type UploadEvent,
  type UploadState,
} from "../../client/upload-state.ts";

export interface UploadSession {
  readonly busy: boolean;
  cancel(): void;
  reset(): void;
  retry(): void;
  select(file: File, purpose: UploadPurpose): void;
  readonly state: UploadState;
}

// Connects the pure state machine and runner to React: it owns the abort controller and the chosen
// file, and nothing else. `onEvent` lets a parent react to events (for example refreshing a list)
// without the hook knowing about it.
export function useUploadSession(
  services: UploadsClientServices,
  onEvent?: (event: UploadEvent) => void,
): UploadSession {
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
  const stateRef = useRef(state);
  const controllerRef = useRef<AbortController | null>(null);
  const subject = useRef<{ checked: CheckedFile; file: File } | null>(null);
  const onEventRef = useRef(onEvent);
  // True from the moment a run starts until it settles, so a double click cannot start two runs.
  const runningRef = useRef(false);

  const runner = useMemo(
    () =>
      createUploadRunner({
        api: services.api,
        policy: services.policy,
        sleep: services.sleep,
        transfer: services.transfer,
      }),
    [services],
  );

  const start = useCallback(
    (attempt: UploadAttempt) => {
      const current = subject.current;
      if (current === null || runningRef.current) return;
      runningRef.current = true;
      const controller = new AbortController();
      controllerRef.current = controller;
      const emit = (event: UploadEvent) => {
        dispatch(event);
        onEventRef.current?.(event);
      };
      runner({
        attempt,
        checked: current.checked,
        emit,
        file: current.file,
        signal: controller.signal,
      })
        // The runner reports every expected failure itself; reaching here means a defect, and the
        // screen must not be left waiting on a run that is over.
        .catch(() =>
          emit({
            cause: { kind: "unexpected" },
            retryable: false,
            type: "failed",
          }),
        )
        .finally(() => {
          runningRef.current = false;
        });
    },
    [runner],
  );

  // Event handlers read the latest state and callback through refs, updated after each render.
  useEffect(() => {
    stateRef.current = state;
    onEventRef.current = onEvent;
  });
  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    busy: isUploadBusy(state),
    cancel: () => controllerRef.current?.abort(),
    reset: () => {
      subject.current = null;
      dispatch({ type: "reset" });
    },
    retry: () => {
      const current = stateRef.current;
      if (
        current.status !== "failed" &&
        current.status !== "cancelled" &&
        current.status !== "still-processing"
      )
        return;
      dispatch({ type: "retry" });
      start(current.attempt);
    },
    select: (file, purpose) => {
      if (isUploadBusy(stateRef.current)) return;
      const checked = checkFile(file, purpose);
      if (!checked.ok)
        return dispatch({ rejection: checked.rejection, type: "file-invalid" });
      subject.current = { checked: checked.file, file };
      const attempt = createUploadAttempt({
        file: { name: file.name, size: file.size },
        idempotencyKey: services.createIdempotencyKey(),
        purpose,
      });
      dispatch({ attempt, type: "started" });
      start(attempt);
    },
    state,
  };
}

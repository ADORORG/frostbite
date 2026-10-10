"use client";

import {
  defaultUploadPolicy,
  uploadContentTypes,
  type UploadPurpose,
} from "@ador/shared/uploads";
import { ArcadeFileDrop } from "@repo/ui/arcade";
import { useCallback, useRef, useState } from "react";

import {
  createBrowserServices,
  type UploadsClientServices,
} from "../client/browser-services.ts";
import { purposeLabels } from "../client/purpose-labels.ts";
import { describeByteLimit } from "../client/rejection-copy.ts";
import type { UploadEvent } from "../client/upload-state.ts";
import { UploadFeedback } from "./components/upload-feedback.tsx";
import { useUploadSession } from "./hooks/use-upload-session.ts";

const accept = uploadContentTypes.join(",");

// An uploader for one purpose, for use inside another page (a collection's images step) so a creator
// never has to leave it. It reports the new image once it has been validated and processed, never
// earlier: an image still processing, or one that was refused, is not offered for use.
export function InlineUpload({
  onUploaded,
  purpose,
  services: provided,
}: {
  readonly onUploaded: (assetId: string) => void;
  readonly purpose: UploadPurpose;
  // Defaults to the browser's own fetch, XHR, crypto, and timers; tests pass fakes.
  readonly services?: UploadsClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  // The asset exists from the moment the upload is completed, but is usable only when it finishes.
  const assetId = useRef<string | null>(null);
  const onEvent = useCallback(
    (event: UploadEvent) => {
      if (event.type === "completed") assetId.current = event.assetId;
      if (
        event.type === "finished" &&
        event.outcome === "processed" &&
        assetId.current !== null
      )
        onUploaded(assetId.current);
    },
    [onUploaded],
  );
  const session = useUploadSession(services, onEvent);
  const limit = describeByteLimit(
    defaultUploadPolicy.maxBytesByPurpose[purpose],
  );
  return (
    <div className="arcade-form">
      <ArcadeFileDrop
        accept={accept}
        disabled={session.busy}
        hint={`PNG, JPEG, or WebP, up to ${limit}. Animated images are not supported.`}
        label={`Upload ${purposeLabels[purpose].toLowerCase()}`}
        onFile={(file) => session.select(file, purpose)}
      />
      <UploadFeedback
        onCancel={session.cancel}
        onReset={session.reset}
        onRetry={session.retry}
        state={session.state}
      />
    </div>
  );
}

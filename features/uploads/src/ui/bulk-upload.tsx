"use client";

import {
  defaultUploadPolicy,
  uploadContentTypes,
  type UploadPurpose,
} from "@frostbite/shared/uploads";
import {
  ArcadeActionButton,
  ArcadeFileDrop,
  ArcadeProgress,
} from "@repo/ui/arcade";
import { useEffect, useRef, useState } from "react";

import { describeBulkSummary } from "../client/bulk-messages.ts";
import {
  createBrowserServices,
  type UploadsClientServices,
} from "../client/browser-services.ts";
import { purposeLabels } from "../client/purpose-labels.ts";
import {
  describeByteLimit,
  formatsToChoose,
} from "../client/rejection-copy.ts";
import { BulkUploadList } from "./components/bulk-upload-list.tsx";
import { useBulkUpload } from "./hooks/use-bulk-upload.ts";

const accept = uploadContentTypes.join(",");

// Many images at once, for use inside another page. Each file keeps its own name (so a list of items can
// name its images), is sent a few at a time, and is reported on separately.
export function BulkUpload({
  onProcessed,
  onSettled,
  purpose,
  services: provided,
}: {
  // Called with each image once it has been checked and processed, and never before.
  readonly onProcessed?: (assetId: string, fileName: string) => void;
  // Called each time the batch comes to rest (nothing waiting or moving), so a page can read the library
  // once instead of once per image.
  readonly onSettled?: () => void;
  readonly purpose: UploadPurpose;
  // Defaults to the browser's own fetch, XHR, crypto, and timers; tests pass fakes.
  readonly services?: UploadsClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const [skipped, setSkipped] = useState(0);
  const bulk = useBulkUpload(services, purpose, { onProcessed });
  const { summary } = bulk;
  const wasBusy = useRef(false);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
    if (wasBusy.current && !bulk.busy) onSettledRef.current?.();
    wasBusy.current = bulk.busy;
  }, [bulk.busy, onSettled]);
  const limit = describeByteLimit(
    defaultUploadPolicy.maxBytesByPurpose[purpose],
  );
  return (
    <div className="arcade-form">
      <ArcadeFileDrop
        accept={accept}
        hint={`${formatsToChoose}, up to ${limit} each, up to ${services.policy.bulkFileLimit} files in one go. Each file keeps its name.`}
        label={`Upload many: ${purposeLabels[purpose].toLowerCase()}`}
        onFiles={(files) => setSkipped(bulk.add(files).skipped)}
      />
      {skipped > 0 ? (
        <p role="alert">
          {`${skipped} ${skipped === 1 ? "file was" : "files were"} not added, because one batch takes up to ${services.policy.bulkFileLimit}. Add them after these finish.`}
        </p>
      ) : null}
      {summary.total === 0 ? null : (
        <>
          <p role="status">{describeBulkSummary(summary)}</p>
          <ArcadeProgress
            label="Files finished"
            value={
              (summary.ready + summary.refused + summary.needsAttention) /
              summary.total
            }
          />
          <div className="arcade-actions">
            {bulk.busy ? (
              <ArcadeActionButton onClick={bulk.cancel} tone="red">
                Cancel the rest
              </ArcadeActionButton>
            ) : (
              <ArcadeActionButton onClick={bulk.clear} tone="cyan">
                Clear the list
              </ArcadeActionButton>
            )}
            {summary.needsAttention > 0 ? (
              <ArcadeActionButton onClick={bulk.retryAll} tone="yellow">
                Retry all that can be retried
              </ArcadeActionButton>
            ) : null}
          </div>
          <BulkUploadList entries={bulk.state.entries} onRetry={bulk.retry} />
        </>
      )}
    </div>
  );
}

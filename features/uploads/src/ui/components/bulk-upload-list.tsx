import { ArcadeActionButton, StatusLamp } from "@repo/ui/arcade";

import { describeBulkEntry } from "../../client/bulk-messages.ts";
import { canRetry, type BulkEntry } from "../../client/bulk-state.ts";

// Every file in the batch with what happened to it. A file that needs another try has its own button; a
// refused file says why, because only a different file can fix it.
export function BulkUploadList({
  entries,
  onRetry,
}: {
  readonly entries: readonly BulkEntry[];
  readonly onRetry: (id: string) => void;
}) {
  return (
    <ul aria-label="Files in this upload" className="arcade-scroll-list">
      {entries.map((entry) => {
        const message = describeBulkEntry(entry);
        return (
          <li key={entry.id}>
            <strong>{entry.name}</strong>
            <StatusLamp label={message.text} tone={message.tone} />
            {canRetry(entry.state) ? (
              <ArcadeActionButton
                onClick={() => onRetry(entry.id)}
                tone="yellow"
              >
                {`Retry ${entry.name}`}
              </ArcadeActionButton>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

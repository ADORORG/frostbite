import { collectionStudioPath } from "@ador/shared/collections";
import { uploadsStudioPath } from "@ador/shared/uploads";
import { ArcadeButton, ArcadePanel } from "@repo/ui/arcade";

import type { UploadSession } from "../hooks/use-upload-session.ts";
import { UploadFeedback } from "./upload-feedback.tsx";
import { UploadForm } from "./upload-form.tsx";

export function UploadPanel({ session }: { readonly session: UploadSession }) {
  return (
    <ArcadePanel eyebrow="Private drafts" title="Choose a file">
      <UploadForm disabled={session.busy} onFile={session.select} />
      <UploadFeedback
        next={
          <>
            <ArcadeButton href={collectionStudioPath} tone="mint">
              Use it in a collection
            </ArcadeButton>
            <ArcadeButton href={uploadsStudioPath}>
              See your library
            </ArcadeButton>
          </>
        }
        onCancel={session.cancel}
        onReset={session.reset}
        onRetry={session.retry}
        state={session.state}
      />
    </ArcadePanel>
  );
}

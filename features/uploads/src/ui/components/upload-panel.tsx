import { ArcadePanel } from "@repo/ui/arcade";

import type { UploadSession } from "../hooks/use-upload-session.ts";
import { UploadFeedback } from "./upload-feedback.tsx";
import { UploadForm } from "./upload-form.tsx";

export function UploadPanel({ session }: { readonly session: UploadSession }) {
  return (
    <ArcadePanel eyebrow="Private drafts" title="Upload an image">
      <UploadForm disabled={session.busy} onFile={session.select} />
      <UploadFeedback
        onCancel={session.cancel}
        onReset={session.reset}
        onRetry={session.retry}
        state={session.state}
      />
    </ArcadePanel>
  );
}

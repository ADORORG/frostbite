import type { LibraryResponse } from "@ador/shared/uploads";
import { ArcadeActionButton, StatusLamp } from "@repo/ui/arcade";

import type { DraftFormValues } from "../../client/draft-form.ts";
import type { Resource } from "../hooks/use-resource.ts";
import { ImageChoice } from "./image-choice.tsx";

// The cover and the banner, chosen from the creator's own library. The library loads on its own, so a
// slow or failed load never hides the rest of the wizard.
export function ImagesStep({
  disabled,
  form,
  library,
  onChange,
  onRefresh,
  onUploaded,
}: {
  readonly disabled: boolean;
  readonly form: DraftFormValues;
  readonly library: Resource<LibraryResponse>;
  readonly onChange: (changes: Partial<DraftFormValues>) => void;
  readonly onRefresh: () => void;
  readonly onUploaded: () => Promise<void>;
}) {
  const loaded = library.status === "loading" ? null : library.data;
  return (
    <div className="arcade-form">
      {library.status === "loading" ? (
        <StatusLamp label="Loading your images…" tone="attention" />
      ) : null}
      {library.status === "error" ? (
        <>
          <StatusLamp
            label={
              loaded === null
                ? "Your images could not be loaded."
                : "Could not refresh your images. Showing what was loaded earlier."
            }
            tone="unavailable"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={onRefresh} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </>
      ) : null}
      {loaded === null ? null : (
        <>
          <ImageChoice
            allowNone
            assets={loaded.assets}
            disabled={disabled}
            legend="Cover image"
            onChange={(coverAssetId) => onChange({ coverAssetId })}
            purpose="collection-artwork"
            selectedId={form.coverAssetId}
            onUploaded={onUploaded}
          />
          <ImageChoice
            allowNone
            assets={loaded.assets}
            disabled={disabled}
            legend="Banner image"
            onChange={(bannerAssetId) => onChange({ bannerAssetId })}
            purpose="collection-banner"
            selectedId={form.bannerAssetId}
            onUploaded={onUploaded}
          />
          {loaded.nextCursor !== null ? (
            <StatusLamp
              label="Showing your newest images. Older ones are not listed yet."
              tone="attention"
            />
          ) : null}
          <div className="arcade-actions">
            <ArcadeActionButton
              disabled={disabled}
              onClick={onRefresh}
              tone="yellow"
            >
              Refresh images
            </ArcadeActionButton>
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import {
  defaultUploadPolicy,
  uploadContentTypes,
  type UploadPurpose,
} from "@ador/shared/uploads";
import { ArcadeFileDrop, ArcadeSelect } from "@repo/ui/arcade";

import { purposeOptions } from "../../client/purpose-labels.ts";
import {
  describeByteLimit,
  describeUploadHint,
} from "../../client/rejection-copy.ts";

const accept = uploadContentTypes.join(",");

// The inputs for starting an upload: what the file is for, and the file itself. It holds only the
// chosen purpose; the upload itself is the parent's concern.
export function UploadForm({
  disabled,
  onFile,
}: {
  readonly disabled: boolean;
  readonly onFile: (file: File, purpose: UploadPurpose) => void;
}) {
  const [purpose, setPurpose] = useState<UploadPurpose>("collection-artwork");
  const limit = describeByteLimit(
    defaultUploadPolicy.maxBytesByPurpose[purpose],
  );
  return (
    <div className="arcade-form">
      <ArcadeSelect
        disabled={disabled}
        label="What is this image for?"
        onChange={setPurpose}
        options={purposeOptions}
        value={purpose}
      />
      <ArcadeFileDrop
        accept={accept}
        disabled={disabled}
        hint={describeUploadHint(limit)}
        label="Choose an image or drop it here"
        onFile={(file) => onFile(file, purpose)}
      />
    </div>
  );
}

import {
  defaultUploadPolicy,
  uploadContentTypes,
  type UploadContentType,
  type UploadPurpose,
} from "@ador/shared/uploads";

export type FileRejection =
  | { readonly kind: "empty" }
  | { readonly kind: "unsupported-type"; readonly contentType: string }
  | { readonly kind: "too-large"; readonly maxBytes: number };

export interface CheckedFile {
  readonly byteLength: number;
  readonly contentType: UploadContentType;
}

const supported: readonly string[] = uploadContentTypes;

function isSupported(contentType: string): contentType is UploadContentType {
  return supported.includes(contentType);
}

// Early feedback only: the server re-validates type and size, and later the bytes themselves. The
// declared type comes from the browser and is not evidence of the file's real format.
export function checkFile(
  file: { readonly size: number; readonly type: string },
  purpose: UploadPurpose,
  maxBytesByPurpose: Readonly<
    Record<UploadPurpose, number>
  > = defaultUploadPolicy.maxBytesByPurpose,
):
  | { readonly file: CheckedFile; readonly ok: true }
  | { readonly ok: false; readonly rejection: FileRejection } {
  if (file.size <= 0) return { ok: false, rejection: { kind: "empty" } };
  if (!isSupported(file.type))
    return {
      ok: false,
      rejection: { contentType: file.type, kind: "unsupported-type" },
    };
  const maxBytes = maxBytesByPurpose[purpose];
  if (file.size > maxBytes)
    return { ok: false, rejection: { kind: "too-large", maxBytes } };
  return { file: { byteLength: file.size, contentType: file.type }, ok: true };
}

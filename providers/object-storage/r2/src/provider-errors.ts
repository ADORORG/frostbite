import { ObjectStorageError } from "@frostbite/object-storage/errors";

interface ProviderErrorShape {
  readonly $metadata?: { readonly httpStatusCode?: number };
  readonly name?: string;
}

// `unknown` is contained here because caught SDK/network values are genuinely untrusted.
function inspectProviderError(value: unknown): ProviderErrorShape {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const metadata = record.$metadata;
  const httpStatusCode =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>).httpStatusCode
      : undefined;
  return {
    name: typeof record.name === "string" ? record.name : undefined,
    ...(typeof httpStatusCode === "number"
      ? { $metadata: { httpStatusCode } }
      : {}),
  };
}

export function translateProviderError(error: unknown): ObjectStorageError {
  const inspected = inspectProviderError(error);
  const status = inspected.$metadata?.httpStatusCode;
  if (
    status === 404 ||
    inspected.name === "NoSuchKey" ||
    inspected.name === "NotFound"
  ) {
    return new ObjectStorageError(
      "not-found",
      "The requested object does not exist.",
      {
        cause: error,
      },
    );
  }
  if (status === 412 || inspected.name === "PreconditionFailed") {
    return new ObjectStorageError(
      "conflict",
      "An object-storage precondition was not satisfied.",
      {
        cause: error,
      },
    );
  }
  return new ObjectStorageError(
    "provider-failure",
    "The object-storage provider request failed.",
    {
      cause: error,
    },
  );
}

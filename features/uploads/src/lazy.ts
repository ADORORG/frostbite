// Builds a value on first use and shares it afterwards. A failed build is forgotten, so a missing
// setting or an unavailable provider does not poison later calls.
export function memoizeUntilFailure<Value>(
  build: () => Promise<Value>,
): () => Promise<Value> {
  let value: Promise<Value> | undefined;
  return () => {
    value ??= Promise.resolve()
      .then(build)
      .catch((error: Error) => {
        value = undefined;
        throw error;
      });
    return value;
  };
}

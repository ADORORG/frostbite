import type { InternalErrorReport } from "@ador/http";

const maxStackFrames = 8;

// The stack frames of an error, without its message: a database error's message carries the query and its values, which are
// the player's data and must not reach a log. The frames, the error's class and a database error's code say where and what.
function describe(error: unknown): {
  readonly frames: readonly string[];
  readonly name: string;
  readonly code?: string;
} {
  if (!(error instanceof Error)) return { frames: [], name: typeof error };
  const source =
    typeof error.cause === "object" && error.cause !== null
      ? error.cause
      : error;
  const code = Reflect.get(source, "code");
  return {
    ...(typeof code === "string" ? { code } : {}),
    frames: (error.stack ?? "")
      .split("\n")
      .filter((line) => line.trimStart().startsWith("at "))
      .slice(0, maxStackFrames)
      .map((line) => line.trim()),
    name: error.name,
  };
}

// One line of JSON per internal error, found by the correlation id the caller was given.
export function logInternalError(
  report: InternalErrorReport,
  write: (line: string) => void = (line) => console.error(line),
): void {
  write(
    JSON.stringify({
      correlationId: report.correlationId,
      event: "http.internal_error",
      kind: report.kind,
      operationId: report.operationId,
      ...(report.kind === "exception" ? describe(report.error) : {}),
      ...(report.kind === "undeclared-error" ? { code: report.code } : {}),
    }),
  );
}

// The session service could not be reached while a request needed it: the caller gets a 503, the operator gets this line.
export function logAuthUnavailable(
  details: { readonly correlationId: string; readonly operationId: string },
  write: (line: string) => void = (line) => console.error(line),
): void {
  write(
    JSON.stringify({
      correlationId: details.correlationId,
      event: "http.auth_unavailable",
      operationId: details.operationId,
    }),
  );
}

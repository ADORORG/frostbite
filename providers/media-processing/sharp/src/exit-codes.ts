// Exit codes the worker itself chooses. They mean the worker could not do its job (a platform
// fault), as opposed to a file that exhausted a limit, which ends by signal or by our own kill.
export const workerExitCodes = {
  protocolViolation: 2,
  unexpectedError: 1,
} as const;

export function isWorkerFault(exitCode: number | null): boolean {
  return (
    exitCode === workerExitCodes.protocolViolation ||
    exitCode === workerExitCodes.unexpectedError
  );
}

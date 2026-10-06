import { workerExitCodes } from "./exit-codes.ts";
import { handleRequest } from "./handle-request.ts";

// Thin process shell: all behavior lives in handleRequest. It runs only inside the isolated child,
// so it is exercised by the isolated-processor integration tests rather than in-process coverage.
async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks);
}

handleRequest(await readStdin()).then(
  (reply) => {
    if (reply === null) process.exit(workerExitCodes.protocolViolation);
    process.stdout.write(reply, () => process.exit(0));
  },
  () => process.exit(workerExitCodes.unexpectedError),
);

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createPostgresContainerArguments,
  postgresUrl,
  waitForPostgres,
} from "../../../packages/database/test/support/postgres-container.ts";
import {
  ensureRunning,
  findContainer,
  stopKeeping,
  wipe,
  type Docker,
} from "@ador/test-kit/durable-container";

// The parts of the local stack that outlive a run: the database and the object storage. Named so a second start finds them again; the
// secrets they were first made with are kept beside the repository (ignored by git), because a volume remembers its first password.
export const durableStack = {
  postgres: {
    container: "ador-stack-postgres",
    volume: "ador-stack-postgres-data",
  },
  s3: { container: "ador-stack-minio", volume: "ador-stack-minio-data" },
} as const;

export interface StackSecrets {
  readonly postgresPassword: string;
  readonly s3Secret: string;
}

const secretsFile = "secrets.json";

// The passwords the durable containers were made with: read if the stack has run here before, made and kept (readable by the owner
// only) if not. They protect a database and a store that listen on this machine's loopback only.
export async function stackSecrets(
  directory: string,
  make: () => string = randomUUID,
): Promise<StackSecrets> {
  const path = join(directory, secretsFile);
  try {
    const found: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      typeof found === "object" &&
      found !== null &&
      "postgresPassword" in found &&
      typeof found.postgresPassword === "string" &&
      "s3Secret" in found &&
      typeof found.s3Secret === "string"
    )
      return {
        postgresPassword: found.postgresPassword,
        s3Secret: found.s3Secret,
      };
  } catch {
    // Nothing kept yet (or unreadable): made below.
  }
  const secrets = { postgresPassword: make(), s3Secret: make() };
  await mkdir(directory, { recursive: true });
  await writeFile(path, JSON.stringify(secrets), { mode: 0o600 });
  return secrets;
}

// Data in a volume that this directory holds no password for cannot be opened. Said plainly, with the way out, instead of failing as a
// wrong password deep in a connection.
export async function assertOpenable(
  directory: string,
  container: string = durableStack.postgres.container,
  docker?: Docker,
): Promise<void> {
  const kept = await readFile(join(directory, secretsFile), "utf8").then(
    () => true,
    () => false,
  );
  if (kept) return;
  const found = await findContainer(container, docker);
  if (found !== "missing")
    throw new Error(
      "The stack's database was made on a run whose passwords are gone. Start over with `pnpm stack --fresh` (this deletes its data).",
    );
}

// Runs `callback` against the stack's own PostgreSQL: started if stopped, made if new, and only stopped (data kept) afterwards.
export async function withDurablePostgres(
  input: {
    readonly directory: string;
    readonly docker?: Docker;
    // The container and volume to keep the data in; the stack's own unless a test names others.
    readonly names?: { readonly container: string; readonly volume: string };
  },
  callback: (databaseUrl: string, kept: boolean) => Promise<void>,
): Promise<void> {
  const { container, volume } = input.names ?? durableStack.postgres;
  await assertOpenable(input.directory, container, input.docker);
  const { postgresPassword } = await stackSecrets(input.directory);
  const found = await ensureRunning(
    {
      create: createPostgresContainerArguments({
        containerName: container,
        password: postgresPassword,
        volume,
      }),
      name: container,
    },
    input.docker,
  );
  try {
    await waitForPostgres(container);
    await callback(
      await postgresUrl(container, postgresPassword),
      found !== "missing",
    );
  } finally {
    await stopKeeping(container, input.docker);
  }
}

// Deletes the stack's data: both containers, both volumes and the kept passwords.
export async function wipeStack(
  directory: string,
  docker?: Docker,
): Promise<void> {
  await wipe(
    {
      containers: [durableStack.postgres.container, durableStack.s3.container],
      volumes: [durableStack.postgres.volume, durableStack.s3.volume],
    },
    docker,
  );
  await rm(join(directory, secretsFile), { force: true });
}

import { runDocker } from "./docker.ts";

// The Docker calls this module makes, injectable so the order of them can be tested without Docker.
export type Docker = (args: readonly string[]) => Promise<string>;

export type Found = "missing" | "running" | "stopped";

// A container that outlives a run: kept by name, with its data in a named volume, and only stopped (never removed) when a run ends.
// This is for a local stack a person keeps coming back to; a test run that must start clean uses a disposable container instead.

// Where a container stands: it exists and runs, exists and is stopped, or does not exist. Asked by listing (which says nothing for a
// name nothing has) and not by inspecting (which fails, and prints the failure, for one).
export async function findContainer(
  name: string,
  docker: Docker = runDocker,
): Promise<Found> {
  const state = await docker([
    "ps",
    "--all",
    "--filter",
    `name=^${name}$`,
    "--format",
    "{{.State}}",
  ]);
  if (state === "") return "missing";
  return state === "running" ? "running" : "stopped";
}

// Makes the named container run: starts it if it was stopped, creates it with `create` (the `docker run` arguments, which must name
// it) if it does not exist, leaves it alone if it already runs. Returns what it found, so a caller knows if the data is old.
export async function ensureRunning(
  input: { readonly create: readonly string[]; readonly name: string },
  docker: Docker = runDocker,
): Promise<Found> {
  const found = await findContainer(input.name, docker);
  if (found === "missing") await docker(input.create);
  else if (found === "stopped") await docker(["start", input.name]);
  return found;
}

// Stops the container and keeps it, and its volume, for the next run.
export async function stopKeeping(
  name: string,
  docker: Docker = runDocker,
): Promise<void> {
  if ((await findContainer(name, docker)) === "running")
    await docker(["stop", "--time", "10", name]);
}

// Removes the containers and the volumes: the data is gone. A name nothing has is fine.
export async function wipe(
  input: {
    readonly containers: readonly string[];
    readonly volumes: readonly string[];
  },
  docker: Docker = runDocker,
): Promise<void> {
  for (const name of input.containers)
    if ((await findContainer(name, docker)) !== "missing")
      await docker(["rm", "--force", name]);
  for (const volume of input.volumes)
    await docker(["volume", "rm", "--force", volume]);
}

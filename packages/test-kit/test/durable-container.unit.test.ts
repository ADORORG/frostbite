import { describe, expect, it } from "vitest";

import {
  ensureRunning,
  findContainer,
  stopKeeping,
  wipe,
  type Docker,
} from "../src/durable-container.ts";

// A Docker that knows containers by name and says what it was asked, in order.
function fakeDocker(containers: Record<string, boolean>) {
  const calls: (readonly string[])[] = [];
  const docker: Docker = async (args) => {
    calls.push(args);
    if (args[0] === "ps") {
      const name = (args[3] ?? "").slice("name=^".length, -1);
      const running = containers[name];
      return running === undefined ? "" : running ? "running" : "exited";
    }
    return "";
  };
  return { calls, docker };
}

const create = ["run", "--detach", "--name", "keep", "image"] as const;
const verbs = (calls: readonly (readonly string[])[]) =>
  calls.map(([verb]) => verb);

describe("a container kept between runs", () => {
  it("tells whether it runs, is stopped, or is not there", async () => {
    const { docker } = fakeDocker({ here: true, off: false });
    expect(await findContainer("here", docker)).toBe("running");
    expect(await findContainer("off", docker)).toBe("stopped");
    expect(await findContainer("nothing", docker)).toBe("missing");
  });

  it("creates it when it is missing, starts it when it is stopped, and leaves it alone when it runs", async () => {
    const missing = fakeDocker({});
    expect(await ensureRunning({ create, name: "keep" }, missing.docker)).toBe(
      "missing",
    );
    expect(missing.calls.at(-1)).toEqual(create);
    const stopped = fakeDocker({ keep: false });
    expect(await ensureRunning({ create, name: "keep" }, stopped.docker)).toBe(
      "stopped",
    );
    expect(stopped.calls.at(-1)).toEqual(["start", "keep"]);
    const running = fakeDocker({ keep: true });
    expect(await ensureRunning({ create, name: "keep" }, running.docker)).toBe(
      "running",
    );
    expect(verbs(running.calls)).toEqual(["ps"]);
  });

  it("is stopped and kept, never removed, when a run ends, and stopping what is not running does nothing", async () => {
    const running = fakeDocker({ keep: true });
    await stopKeeping("keep", running.docker);
    expect(verbs(running.calls)).toEqual(["ps", "stop"]);
    expect(running.calls.flat()).not.toContain("rm");
    const off = fakeDocker({ keep: false });
    await stopKeeping("keep", off.docker);
    expect(verbs(off.calls)).toEqual(["ps"]);
  });

  it("is removed with its volume only when asked to wipe, skipping a container that is not there", async () => {
    const { calls, docker } = fakeDocker({ db: true });
    await wipe({ containers: ["db", "gone"], volumes: ["data"] }, docker);
    expect(calls).toEqual([
      ["ps", "--all", "--filter", "name=^db$", "--format", "{{.State}}"],
      ["rm", "--force", "db"],
      ["ps", "--all", "--filter", "name=^gone$", "--format", "{{.State}}"],
      ["volume", "rm", "--force", "data"],
    ]);
  });
});

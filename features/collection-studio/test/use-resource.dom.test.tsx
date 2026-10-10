import { ApiError } from "@ador/client-http";
import {
  button,
  click,
  mount,
  settle,
  textOf,
  unmountAll,
} from "@ador/test-kit/dom";
import { useEffect, useState } from "react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  useResource,
  type LoadedResource,
} from "../src/ui/hooks/use-resource.ts";

function Probe({
  load,
  onResource,
}: {
  readonly load: (signal: AbortSignal) => Promise<string>;
  readonly onResource?: (resource: LoadedResource<string>) => void;
}) {
  const [keyed, setKeyed] = useState("a");
  const resource = useResource(load, keyed);
  useEffect(() => {
    onResource?.(resource);
  });
  const { state } = resource;
  return (
    <div>
      <p>
        {state.status === "loading" ? "loading" : null}
        {state.status === "ready" ? `ready:${state.data}` : null}
        {state.status === "error"
          ? `error:${state.failure.kind}:${state.data ?? "none"}`
          : null}
      </p>
      <button onClick={() => setKeyed("b")} type="button">
        switch
      </button>
    </div>
  );
}

const text = (container: HTMLElement) =>
  container.querySelector("p")?.textContent;

describe("useResource", () => {
  it("shows loading until the first response arrives, then the data", async () => {
    let finish: (value: string) => void = () => undefined;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const container = await mount(<Probe load={() => pending} />);
    expect(text(container)).toBe("loading");
    finish("one");
    await settle(() => expect(text(container)).toBe("ready:one"));
  });

  it("reports a failure in words, with nothing kept when there was nothing before", async () => {
    const container = await mount(
      <Probe
        load={async () => {
          throw new ApiError("forbidden", 403, "no");
        }}
      />,
    );
    await settle(() => expect(text(container)).toBe("error:not-approved:none"));
  });

  it("keeps the last good data when a reload fails, and recovers on the next reload", async () => {
    let latest: LoadedResource<string> | null = null;
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockRejectedValueOnce(new ApiError("network", null, "x"))
      .mockResolvedValueOnce("third");
    const container = await mount(
      <Probe
        load={load}
        onResource={(resource) => {
          latest = resource;
        }}
      />,
    );
    await settle(() => expect(text(container)).toBe("ready:first"));
    await act(() => latest?.reload());
    await settle(() => expect(text(container)).toBe("error:temporary:first"));
    await act(() => latest?.reload());
    await settle(() => expect(text(container)).toBe("ready:third"));
  });

  it("replaces the value with one the page already holds", async () => {
    let latest: LoadedResource<string> | null = null;
    const container = await mount(
      <Probe
        load={async () => "loaded"}
        onResource={(resource) => {
          latest = resource;
        }}
      />,
    );
    await settle(() => expect(text(container)).toBe("ready:loaded"));
    await act(() => latest?.replace("given"));
    expect(text(container)).toBe("ready:given");
  });

  it("loads again when the key changes, aborting the load it left behind", async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn(async (signal: AbortSignal) => {
      signals.push(signal);
      return `value-${signals.length}`;
    });
    const container = await mount(<Probe load={load} />);
    await settle(() => expect(text(container)).toBe("ready:value-1"));
    await click(button(container, "switch"));
    await settle(() => expect(text(container)).toBe("ready:value-2"));
    expect(signals.map((signal) => signal.aborted)).toEqual([true, false]);
  });

  it("ignores a response that arrives after the page is gone", async () => {
    let finish: (value: string) => void = () => undefined;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const container = await mount(<Probe load={() => pending} />);
    await unmountAll();
    finish("late");
    await act(async () => undefined);
    expect(textOf(container)).toBe("");
  });

  it("ignores a failure that arrives after the page is gone", async () => {
    let fail: (error: Error) => void = () => undefined;
    const pending = new Promise<string>((_resolve, reject) => {
      fail = reject;
    });
    const container = await mount(<Probe load={() => pending} />);
    await unmountAll();
    fail(new Error("late"));
    await act(async () => undefined);
    expect(textOf(container)).toBe("");
  });

  it("shows the newer load when an older one answers last", async () => {
    const answers: ((value: string) => void)[] = [];
    const load = () =>
      new Promise<string>((resolve) => {
        answers.push(resolve);
      });
    const container = await mount(<Probe load={load} />);
    await click(button(container, "switch"));
    await act(async () => answers[1]?.("fresh"));
    await settle(() => expect(text(container)).toBe("ready:fresh"));
    await act(async () => answers[0]?.("stale"));
    expect(text(container)).toBe("ready:fresh");
  });
});

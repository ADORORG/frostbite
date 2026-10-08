import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { UploadApiError } from "../src/client/api-error.ts";
import { TransferError, type ObjectTransfer } from "../src/client/transfer.ts";
import {
  useUploadSession,
  type UploadSession,
} from "../src/ui/hooks/use-upload-session.ts";
import {
  fakeServices,
  imageFile,
  mount,
  settle,
  unmountAll,
} from "./support/dom.tsx";
import { processedAsset } from "./support/library-fixtures.ts";

// Exposes the hook's latest value to the test without any markup.
function probe(services: ReturnType<typeof fakeServices>) {
  const holder: { current: UploadSession | null } = { current: null };
  function Probe() {
    holder.current = useUploadSession(services);
    return null;
  }
  const session = () => {
    if (holder.current === null) throw new Error("hook not mounted");
    return holder.current;
  };
  return { Probe, session };
}

describe("upload session hook", () => {
  it("ignores a second file while one is uploading, and does not spend another key", async () => {
    const release: { current: () => void } = { current: () => undefined };
    const upload = vi.fn<ObjectTransfer["upload"]>(
      () => new Promise<void>((resolve) => (release.current = resolve)),
    );
    const services = fakeServices({ transfer: { upload } });
    const keySpy = vi.spyOn(services, "createIdempotencyKey");
    const { Probe, session } = probe(services);
    await mount(<Probe />);
    await act(async () => session().select(imageFile(), "collection-artwork"));
    await settle(() => expect(upload).toHaveBeenCalledOnce());
    await act(async () => session().select(imageFile(5), "creator-avatar"));
    expect(upload).toHaveBeenCalledOnce();
    expect(keySpy).toHaveBeenCalledOnce();
    expect(session().busy).toBe(true);
    release.current();
    await settle(() => expect(session().busy).toBe(false));
  });

  it("uses a new idempotency key for each new file", async () => {
    const services = fakeServices({
      api: {
        listAssets: async () => ({
          assets: [processedAsset()],
          truncated: false,
        }),
      },
    });
    const { Probe, session } = probe(services);
    await mount(<Probe />);
    await act(async () => session().select(imageFile(), "collection-artwork"));
    await settle(() => expect(session().state.status).toBe("finished"));
    await act(async () => session().reset());
    await act(async () => session().select(imageFile(), "collection-artwork"));
    await settle(() =>
      expect(services.api.createIntent).toHaveBeenCalledTimes(2),
    );
    const keys = services.api.createIntent.mock.calls.map(
      ([, { idempotencyKey }]) => idempotencyKey,
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("does nothing for retry or reset-then-retry when there is nothing to retry", async () => {
    const services = fakeServices();
    const { Probe, session } = probe(services);
    await mount(<Probe />);
    await act(async () => session().retry());
    expect(services.api.createIntent).not.toHaveBeenCalled();
    expect(session().state.status).toBe("idle");
  });

  it("reports a defect as an unexpected, non-retryable failure instead of hanging", async () => {
    const services = fakeServices({
      api: {
        createIntent: async () => {
          throw new TypeError("bug");
        },
      },
    });
    const { Probe, session } = probe(services);
    await mount(<Probe />);
    await act(async () => session().select(imageFile(), "collection-artwork"));
    await settle(() => expect(session().state.status).toBe("failed"));
    expect(session().state).toMatchObject({
      cause: { kind: "unexpected" },
      retryable: false,
    });
    expect(session().busy).toBe(false);
  });

  it("starts only one run when retry is triggered twice in a row", async () => {
    let failing = true;
    const services = fakeServices({
      api: {
        createIntent: async (...args) => {
          if (failing) {
            failing = false;
            throw new UploadApiError("network", null, "offline");
          }
          await new Promise((resolve) => setTimeout(resolve, 30));
          return fakeServices().api.createIntent(...args);
        },
      },
    });
    const { Probe, session } = probe(services);
    await mount(<Probe />);
    await act(async () => session().select(imageFile(), "collection-artwork"));
    await settle(() => expect(session().state.status).toBe("failed"));
    await act(async () => {
      session().retry();
      session().retry();
    });
    await settle(() =>
      expect(services.api.createIntent).toHaveBeenCalledTimes(2),
    );
    await settle(() => expect(session().busy).toBe(false));
    expect(services.api.createIntent).toHaveBeenCalledTimes(2);
  });

  it("aborts the running transfer when the component unmounts", async () => {
    const signals: AbortSignal[] = [];
    const services = fakeServices({
      transfer: {
        upload: ({ signal }) => {
          signals.push(signal);
          return new Promise<void>(() => undefined);
        },
      },
    });
    const { Probe, session } = probe(services);
    await mount(<Probe />);
    await act(async () => session().select(imageFile(), "collection-artwork"));
    await settle(() => expect(signals).toHaveLength(1));
    expect(signals[0]?.aborted).toBe(false);
    await unmountAll();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("retries a cancelled upload with the same attempt", async () => {
    let transfers = 0;
    const services = fakeServices({
      api: {
        listAssets: async () => ({
          assets: [processedAsset()],
          truncated: false,
        }),
      },
      transfer: {
        upload: ({ signal }) => {
          transfers += 1;
          if (transfers > 1) return Promise.resolve();
          return new Promise<void>((_resolve, reject) =>
            signal.addEventListener("abort", () =>
              reject(new TransferError("aborted", null)),
            ),
          );
        },
      },
    });
    const { Probe, session } = probe(services);
    await mount(<Probe />);
    await act(async () => session().select(imageFile(), "collection-artwork"));
    await settle(() => expect(transfers).toBe(1));
    await act(async () => session().cancel());
    await settle(() => expect(session().state.status).toBe("cancelled"));
    await act(async () => session().retry());
    await settle(() => expect(session().state.status).toBe("finished"));
    const keys = services.api.createIntent.mock.calls.map(
      ([, { idempotencyKey }]) => idempotencyKey,
    );
    expect(keys).toEqual(["upload-attempt-0001", "upload-attempt-0001"]);
  });
});

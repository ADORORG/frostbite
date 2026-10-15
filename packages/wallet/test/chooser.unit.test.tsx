// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import {
  useWalletChooser,
  WalletChooserProvider,
} from "../src/client/chooser.tsx";

function Probe() {
  const chooser = useWalletChooser();
  return (
    <>
      <output>{chooser.open ? "open" : "closed"}</output>
      <button onClick={chooser.request} type="button">
        request
      </button>
      <button onClick={chooser.dismiss} type="button">
        dismiss
      </button>
    </>
  );
}

it("is asked from anywhere below the provider, and shows what was asked", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <WalletChooserProvider>
        <Probe />
      </WalletChooserProvider>,
    ),
  );
  const status = () => container.querySelector("output")?.textContent;
  const [request, dismiss] = container.querySelectorAll("button");
  expect(status()).toBe("closed");
  await act(async () => request?.click());
  expect(status()).toBe("open");
  await act(async () => request?.click());
  expect(status()).toBe("open");
  await act(async () => dismiss?.click());
  expect(status()).toBe("closed");
  await act(async () => root.unmount());
});

it("refuses to be used without its provider, so a feature cannot silently ask nobody", () => {
  expect(() => renderToStaticMarkup(<Probe />)).toThrow(
    "needs a WalletProvider",
  );
});

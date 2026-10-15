"use client";

import { useState } from "react";

// Copies an address. It says "Copied" only after the browser accepted it; a browser that refuses (no permission, an
// insecure page) is told so, and the full address stays on screen to copy by hand.
export function CopyAddress({ address }: { readonly address: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  return (
    <>
      <button
        className="wallet-menu__action"
        onClick={() => {
          void navigator.clipboard.writeText(address).then(
            () => setResult("copied"),
            () => setResult("failed"),
          );
        }}
        type="button"
      >
        Copy address
      </button>
      {result === null ? null : (
        <span role="status">
          {result === "copied" ? "Copied" : "Could not copy"}
        </span>
      )}
    </>
  );
}

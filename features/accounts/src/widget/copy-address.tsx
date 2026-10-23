"use client";

import { useState } from "react";

// Copies an address. It says "Copied" only after the browser accepted it; a browser that refuses (no permission, an
// insecure page) is told so, and the full address stays in the menu's title to copy by hand.
export function CopyAddress({ address }: { readonly address: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  return (
    <>
      <button
        aria-label="Copy address"
        className="wallet-identity__copy"
        onClick={() => {
          void navigator.clipboard.writeText(address).then(
            () => setResult("copied"),
            () => setResult("failed"),
          );
        }}
        title="Copy address"
        type="button"
      >
        Copy
      </button>
      {result === null ? null : (
        <span className="wallet-identity__done" role="status">
          {result === "copied" ? "Copied" : "Could not copy"}
        </span>
      )}
    </>
  );
}

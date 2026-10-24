"use client";

import { createContext, useContext, type ReactNode } from "react";

// Where a transaction is shown on a block explorer (`{id}` where its id goes). Provided once by the page's surface; where none is
// provided (a test of one panel) ids are shown as text, without a link.
const ExplorerContext = createContext<string | null>(null);

export function ExplorerBoundary({
  children,
  txUrl,
}: {
  readonly children: ReactNode;
  readonly txUrl: string;
}) {
  return (
    <ExplorerContext.Provider value={txUrl}>
      {children}
    </ExplorerContext.Provider>
  );
}

export const useExplorerTxUrl = () => useContext(ExplorerContext);

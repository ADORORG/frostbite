"use client";

import { KeyValueList } from "@repo/ui/arcade";
import { createContext, useContext, type ReactNode } from "react";

import { explorerLink } from "../domain/explorer-link.ts";

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

// What a transaction with no particular part in a larger step is called.
export const plainTransactionLabel = "Transaction";

// A transaction's id, linking to the explorer when the page has one that can name a transaction, and plain text when it has not.
export function TransactionLink({ id }: { readonly id: string }) {
  const template = useContext(ExplorerContext);
  const href = template === null ? null : explorerLink(template, id);
  return href === null ? (
    id
  ) : (
    <a href={href} rel="noreferrer noopener" target="_blank">
      {id}
    </a>
  );
}

// The transactions a step or claim has put on the network, each under its own label, so staff and players follow them the same way.
export function TransactionList({
  transactions,
}: {
  readonly transactions: readonly {
    readonly id: string;
    readonly label: string;
  }[];
}) {
  return (
    <KeyValueList
      items={transactions.map(({ id, label }) => ({
        label,
        mono: true,
        value: <TransactionLink id={id} />,
      }))}
      label="Transactions on the network"
    />
  );
}

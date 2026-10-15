"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface WalletChooser {
  readonly dismiss: () => void;
  readonly open: boolean;
  // Asks for the wallet chooser to be shown. Whoever renders the chooser (the app's header widget) shows it; a
  // feature that needs a wallet asks here and never builds a chooser of its own.
  readonly request: () => void;
}

const Chooser = createContext<WalletChooser | null>(null);

export function WalletChooserProvider({
  children,
  onRequest,
}: {
  children: ReactNode;
  // Called whenever the chooser is asked for, before it opens (the app starts loading the wallet library here).
  onRequest?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const request = useCallback(() => {
    onRequest?.();
    setOpen(true);
  }, [onRequest]);
  const dismiss = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ dismiss, open, request }),
    [dismiss, open, request],
  );
  return <Chooser.Provider value={value}>{children}</Chooser.Provider>;
}

export function useWalletChooser(): WalletChooser {
  const chooser = useContext(Chooser);
  if (chooser === null)
    throw new Error("The wallet chooser needs a WalletProvider above it.");
  return chooser;
}

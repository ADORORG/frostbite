"use client";

import type { ChainStatusApi } from "@ador/feature-chain-status/api";
import type { FeeSpeed } from "@ador/shared/chain";
import { createContext, useContext, type ReactNode } from "react";

// What a page needs to offer a fee speed: the one it starts on and how often to ask the chain what each costs. Provided once by the
// page's surface; where none is provided (a test of one panel) the picker is not offered and steps are built at the usual speed.
export interface FeeSettings {
  // Where the quotes come from; the platform's own route unless a test supplies another.
  readonly api?: ChainStatusApi;
  readonly defaultSpeed: FeeSpeed;
  readonly refreshMs: number;
}

const FeeSettingsContext = createContext<FeeSettings | null>(null);

export function FeeSettingsBoundary({
  children,
  settings,
}: {
  readonly children: ReactNode;
  readonly settings: FeeSettings;
}) {
  return (
    <FeeSettingsContext.Provider value={settings}>
      {children}
    </FeeSettingsContext.Provider>
  );
}

export const useFeeSettings = () => useContext(FeeSettingsContext);

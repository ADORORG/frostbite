"use client";

import { createContext, useContext, type ReactNode } from "react";

const HeaderEnd = createContext<ReactNode>(null);
const HeaderStatus = createContext<ReactNode>(null);

// What the app puts at the end of the header on every page (the wallet widget). The shell does not know what it is:
// the app supplies it once, in the layout, so no page repeats it and no feature is imported here.
export function ShellSlotsProvider({
  children,
  headerEnd,
}: {
  readonly children: ReactNode;
  readonly headerEnd: ReactNode;
}) {
  return <HeaderEnd.Provider value={headerEnd}>{children}</HeaderEnd.Provider>;
}

export function HeaderSlot() {
  const content = useContext(HeaderEnd);
  return content === null ? null : (
    <div className="app-header__end">{content}</div>
  );
}

// What the app puts in the header on every page to say how the platform is doing (a status lamp). Separate from the end slot so the
// two are supplied by different parts of the app and neither knows of the other.
export function ShellStatusProvider({
  children,
  status,
}: {
  readonly children: ReactNode;
  readonly status: ReactNode;
}) {
  return (
    <HeaderStatus.Provider value={status}>{children}</HeaderStatus.Provider>
  );
}

export function HeaderStatusSlot() {
  const content = useContext(HeaderStatus);
  return content === null ? null : (
    <div className="app-header__status">{content}</div>
  );
}

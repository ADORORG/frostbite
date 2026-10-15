"use client";

import { createContext, useContext, type ReactNode } from "react";

const HeaderEnd = createContext<ReactNode>(null);

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

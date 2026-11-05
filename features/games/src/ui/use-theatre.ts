import { useEffect, useState } from "react";

// Theatre mode: the game takes the whole window (the page's header, its dock and its scrolling step out of the way) without asking
// the browser for full screen, so it works where full screen does not (a phone, an embedded view). It is left with the button or
// Escape, and the page says when it is on, so nothing else on the page can be mistaken for gone.
export function useTheatre() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset["theatre"] = "true";
    const leave = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOn(false);
    };
    document.addEventListener("keydown", leave);
    return () => {
      delete document.documentElement.dataset["theatre"];
      document.removeEventListener("keydown", leave);
    };
  }, [on]);
  return {
    on,
    set: setOn,
    toggle: () => setOn((current) => !current),
  };
}

export type Theatre = ReturnType<typeof useTheatre>;

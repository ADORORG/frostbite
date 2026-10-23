// The row at the bottom of the screen the cabinets' launchers sit in. They used to place themselves (one at the right edge, one a fixed
// distance from it), so a wider font put one on top of the other and hid it. In a row they take the room they need and cannot overlap.
export const cabinetDockId = "cabinet-dock";

// The row, made once and found again by every cabinet that mounts after the first.
export function cabinetDock(page: Document): HTMLElement {
  const found = page.getElementById(cabinetDockId);
  if (found !== null) return found;
  const dock = page.createElement("div");
  dock.id = cabinetDockId;
  dock.className = "cabinet-dock";
  page.body.append(dock);
  return dock;
}

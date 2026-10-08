import type { ReactNode } from "react";

import type { ArcadeTone } from "./arcade-button.tsx";

interface ArcadeBadgeProps {
  readonly children: ReactNode;
  readonly tone?: ArcadeTone;
}

// A compact inline label for a state. It carries no live-region role, so a grid of many badges does
// not flood assistive technology the way a status lamp would.
export function ArcadeBadge({ children, tone = "cyan" }: ArcadeBadgeProps) {
  return (
    <span className={`arcade-badge arcade-badge--${tone}`}>{children}</span>
  );
}

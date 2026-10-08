import type { ReactNode } from "react";

import type { ArcadeTone } from "./arcade-button.tsx";

interface ArcadeActionButtonProps {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly tone?: ArcadeTone;
  readonly type?: "button" | "submit";
}

// The `<button>` counterpart of `ArcadeButton` (which is a link): same look, for actions that do
// something on this page instead of navigating.
export function ArcadeActionButton({
  children,
  disabled = false,
  onClick,
  tone = "cyan",
  type = "button",
}: ArcadeActionButtonProps) {
  return (
    <button
      className={`arcade-button arcade-button--${tone}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

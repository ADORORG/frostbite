import type { ReactNode } from "react";

import { Spinner } from "../components/action-progress.tsx";
import type { ArcadeTone } from "./arcade-button.tsx";

interface ArcadeActionButtonProps {
  // Names the button when its visible words repeat on a page ("Publish" on every card).
  readonly ariaLabel?: string;
  // The action it starts is under way: the ring turns, the button cannot be pressed again, and it says so to assistive technology.
  readonly busy?: boolean;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly size?: "small";
  readonly tone?: ArcadeTone;
  readonly type?: "button" | "submit";
}

// The `<button>` counterpart of `ArcadeButton` (which is a link): same look, for actions that do
// something on this page instead of navigating.
export function ArcadeActionButton({
  ariaLabel,
  busy = false,
  children,
  disabled = false,
  onClick,
  size,
  tone = "cyan",
  type = "button",
}: ArcadeActionButtonProps) {
  return (
    <button
      aria-busy={busy ? true : undefined}
      aria-label={ariaLabel}
      className={`arcade-button arcade-button--${tone}`}
      data-size={size}
      disabled={disabled || busy}
      onClick={onClick}
      type={type}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

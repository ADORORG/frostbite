import type { ReactNode } from "react";

export type ArcadeTone = "cyan" | "mint" | "pink" | "red" | "yellow";

interface ArcadeButtonProps {
  // Names the link when its visible words repeat on a page ("Continue" on every card).
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly href: string;
  readonly tone?: ArcadeTone;
}

export function ArcadeButton({
  ariaLabel,
  children,
  href,
  tone = "cyan",
}: ArcadeButtonProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={`arcade-button arcade-button--${tone}`}
      href={href}
    >
      {children}
    </a>
  );
}

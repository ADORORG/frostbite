import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PageFrame } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The shared frame of the game administration pages: the platform page frame with the staff notices. Every page uses it, so they
// cannot drift apart.
export function AdminFrame({
  children,
  heading,
  intro,
  navigation,
}: {
  readonly children: ReactNode;
  readonly heading: string;
  readonly intro: string;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <PageFrame
      eyebrow="Admin"
      footerLabel="Game rewards"
      heading={heading}
      intro={intro}
      navigation={navigation}
      notices={["◆ STAFF ONLY", "▲ YOU SIGN", "★ LOGGED"]}
    >
      {children}
    </PageFrame>
  );
}

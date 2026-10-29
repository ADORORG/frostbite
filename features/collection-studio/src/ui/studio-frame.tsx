import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PageFrame } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The shared frame of the collection pages: the platform page frame. Every page
// uses it, so they cannot drift apart.
export function StudioFrame({
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
      eyebrow="Studio"
      heading={heading}
      intro={intro}
      navigation={navigation}
    >
      {children}
    </PageFrame>
  );
}

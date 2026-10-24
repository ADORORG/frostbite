import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { PageFrame } from "@repo/ui/arcade";
import type { ReactNode } from "react";

// The shared frame of the uploads pages: the platform page frame. Every page uses
// it, so they cannot drift apart. A server component.
export function UploadsFrame({
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
      footerLabel="Uploads beta"
      heading={heading}
      intro={intro}
      navigation={navigation}
    >
      {children}
    </PageFrame>
  );
}

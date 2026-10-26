import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { ConsolePage } from "@repo/ui/arcade";

import type { Person } from "./roles-flow.ts";
import { RolesPanel } from "./roles-panel.tsx";

// The administrators' role screen (ADR-021 point 7).
export function RolesPage({
  navigation,
  people,
}: {
  readonly navigation: readonly NavigationItem[];
  readonly people: readonly Person[];
}) {
  return (
    <ConsolePage
      eyebrow="Platform administration"
      heading="Platform roles"
      intro="Give a role to a person, or take it away. Staff and administrator roles work only while the account holds a wallet. Every change is recorded with who made it."
      navigation={navigation}
    >
      <RolesPanel initialPeople={people} />
    </ConsolePage>
  );
}

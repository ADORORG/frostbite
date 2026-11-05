import { chainOptionSchema } from "@frostbite/shared/chain";
import { afterEach } from "vitest";

import { CollectionWizard } from "../../src/ui/collection-wizard.tsx";
import type { fakeCollections } from "./fake-api.ts";
import { signet } from "./stubs.ts";

const chains = [
  {
    chainId: signet,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  },
] as const;

export function wizard(fake: ReturnType<typeof fakeCollections>) {
  return (
    <CollectionWizard
      collectionId={fake.state.detail.collection.id}
      services={fake.services}
      targetChains={chains.map((chain) => chainOption(chain))}
    />
  );
}

const chainOption = (chain: (typeof chains)[number]) =>
  chainOptionSchema.parse(chain);

export const heading = (container: HTMLElement) =>
  container.querySelector("h3")?.textContent;

// Each test starts at the page root, so a step left in the URL hash never leaks into the next.
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

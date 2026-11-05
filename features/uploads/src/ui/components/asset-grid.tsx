import type { LibraryAsset } from "@frostbite/shared/uploads";

import { AssetCard } from "./asset-card.tsx";

export function AssetGrid({
  assets,
}: {
  readonly assets: readonly LibraryAsset[];
}) {
  return (
    <ul aria-label="Your uploaded images" className="arcade-grid">
      {assets.map((asset) => (
        <li key={asset.id}>
          <AssetCard asset={asset} />
        </li>
      ))}
    </ul>
  );
}

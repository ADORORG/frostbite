import { DoubleSide, MeshStandardMaterial } from "three";

// Clear window glass.
export const glassPaint = (): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color: "#cfeeff",
    depthWrite: false,
    opacity: 0.16,
    roughness: 0.05,
    side: DoubleSide,
    transparent: true,
  });

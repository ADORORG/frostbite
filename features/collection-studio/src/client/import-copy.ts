import type { CollectionImportProblem } from "@frostbite/shared/collections";

// What a creator is told about a row the server could not accept, in the words of their file.
export function describeImportProblem(
  problem: CollectionImportProblem,
  context: { readonly imageFileName: string; readonly plannedSupply: number },
): string {
  switch (problem) {
    case "image-not-found":
      return `None of your uploaded item images is named "${context.imageFileName}". Upload it first, or fix the name.`;
    case "over-supply":
      return `This would go past the planned supply of ${context.plannedSupply}. Raise the supply on the supply step, or leave this item out.`;
  }
}

import type { ImageProcessor } from "@frostbite/media/processing";
import type { DerivativePolicy } from "@frostbite/shared/uploads";

import { createIsolatedImageProcessor } from "./isolated-processor.ts";
import { createNodeWorkerLauncher } from "./process-launcher.ts";

// Composition root for the sharp adapter: the real Node launcher around the bundled worker.
export function createSharpImageProcessor(
  policy: Pick<
    DerivativePolicy,
    "maxDerivativeBytes" | "wallTimeMs" | "workerMaxHeapMegabytes"
  >,
): ImageProcessor {
  return createIsolatedImageProcessor({
    launcher: createNodeWorkerLauncher(),
    policy,
  });
}

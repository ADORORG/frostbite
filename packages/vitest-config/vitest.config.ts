import { packageVitestConfig } from "./src/package-config.ts";

export default packageVitestConfig({
  coverage: { include: ["src/**/*.ts"] },
});

import { afterEach } from "vitest";

import { unmountAll } from "./support/dom.tsx";

// React needs to know it runs under a test harness so `act` batches updates.
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
afterEach(unmountAll);

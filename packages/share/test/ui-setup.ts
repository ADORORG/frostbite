import {
  installDialogShim,
  installReactTestEnvironment,
} from "@frostbite/test-kit/dom";

// React needs to know it runs under a test harness so `act` batches updates; trees are unmounted
// after each test.
installReactTestEnvironment();
installDialogShim();

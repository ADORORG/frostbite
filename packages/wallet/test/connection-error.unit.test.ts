import { expect, it } from "vitest";
import { classifyWalletConnectionError } from "../src/client/connection-error.ts";

it.each([
  new Error("Wallet not initialized"),
  { code: -32603, message: "wallet must has at least one account" },
  new Error("No accounts found"),
])("distinguishes account setup from installation", (error) => {
  const failure = classifyWalletConnectionError(error);
  expect(failure.kind).toBe("account-setup-required");
  expect(failure.message).toContain("create or import an account");
});
it.each([
  new Error("Wallet not installed"),
  new Error("Leather isn't installed"),
  new Error("No Orange Bitcoin wallet installed"),
  new Error("Tokeo wallet not found"),
  new Error("Keplr wallet not found"),
])("classifies a missing Bitcoin provider", (error) => {
  expect(classifyWalletConnectionError(error).kind).toBe(
    "provider-unavailable",
  );
});
it.each([new Error("rejected"), { message: "cancelled" }])(
  "classifies cancellation",
  (error) => {
    expect(classifyWalletConnectionError(error).kind).toBe("cancelled");
  },
);
it.each([
  null,
  undefined,
  "secret",
  {},
  { message: 42 },
  new TypeError("Cannot read properties of undefined (reading 'connect')"),
])("does not treat integration faults as missing extensions", (error) => {
  expect(classifyWalletConnectionError(error)).toEqual({
    kind: "integration-failure",
    message:
      "Wallet connection failed. The wallet integration could not complete the request. Retry; if this persists, try another wallet.",
  });
});

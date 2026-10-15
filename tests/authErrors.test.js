import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "../src/utils/authErrors";

describe("getAuthErrorMessage", () => {
  it.each([
    ["auth/invalid-credential", "Invalid email or password."],
    ["auth/wrong-password", "Invalid email or password."],
    ["auth/user-not-found", "Invalid email or password."],
    ["auth/email-already-in-use", "An account with this email already exists."],
    ["auth/weak-password", "Password must be at least 6 characters."],
    ["auth/invalid-email", "Enter a valid email address."],
    ["auth/missing-email", "Enter your email address."],
    ["auth/too-many-requests", "Too many attempts. Please try again later."],
    [
      "auth/network-request-failed",
      "Network error. Check your connection and try again.",
    ],
  ])("maps %s to its message", (code, message) => {
    expect(getAuthErrorMessage({ code })).toBe(message);
  });

  it.each(["auth/popup-closed-by-user", "auth/cancelled-popup-request"])(
    "returns null for %s",
    (code) => {
      expect(getAuthErrorMessage({ code })).toBeNull();
    },
  );

  it("falls back to a generic message for unknown codes and shapes", () => {
    const fallback = "Something went wrong. Please try again.";
    expect(getAuthErrorMessage({ code: "auth/unknown" })).toBe(fallback);
    expect(getAuthErrorMessage(new Error("boom"))).toBe(fallback);
    expect(getAuthErrorMessage({ code: "toString" })).toBe(fallback);
    expect(getAuthErrorMessage(undefined)).toBe(fallback);
    expect(getAuthErrorMessage(null)).toBe(fallback);
  });
});

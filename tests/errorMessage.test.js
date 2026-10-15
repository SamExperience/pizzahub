import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../src/utils/errorMessage";

describe("getErrorMessage", () => {
  it("returns the message of a service validation error", () => {
    expect(getErrorMessage(new Error("Category name already exists"))).toBe(
      "Category name already exists",
    );
  });

  it("returns the default fallback for a Firebase error with a code", () => {
    const err = Object.assign(new Error("Missing or insufficient permissions."), {
      code: "permission-denied",
    });

    expect(getErrorMessage(err)).toBe("Something went wrong. Please try again.");
  });

  it("returns the given fallback for values that are not Errors", () => {
    expect(getErrorMessage("boom", "Unable to save.")).toBe("Unable to save.");
  });
});

import { describe, expect, it, vi } from "vitest";
import { signout } from "../src/services/auth.service";
import { signOut } from "firebase/auth";

vi.mock("firebase/auth", () => ({
  signOut: vi.fn(),
}));

vi.mock("../src/services/firebase", () => ({
  auth: {},
}));

describe("signout", () => {
  it("signs out the authenticated user", async () => {
    signOut.mockResolvedValue(undefined);

    await signout();

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("propagates Firebase errors", async () => {
    const error = new Error("Logout failed");
    signOut.mockRejectedValue(error);

    await expect(signout()).rejects.toThrow("Logout failed");
  });
});

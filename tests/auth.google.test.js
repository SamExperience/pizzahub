import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { loginWithGoogle } from "../src/services/auth.service";

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock("../src/services/firebase", () => ({
  auth: {},
}));

describe("loginWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    GoogleAuthProvider.mockImplementation(class MockGoogleAuthProvider {});
  });

  it("logs in with Google successfully", async () => {
    const userCredential = {
      user: {
        uid: "google-user",
        email: "google@example.com",
      },
    };

    signInWithPopup.mockResolvedValue(userCredential);

    const result = await loginWithGoogle();
    const provider = GoogleAuthProvider.mock.instances[0];

    expect(GoogleAuthProvider).toHaveBeenCalledOnce();
    expect(signInWithPopup).toHaveBeenCalledWith({}, provider);
    expect(result).toBe(userCredential);
  });

  it("throws an error when Google Sign-In fails", async () => {
    const error = new Error("Google Sign-In failed");

    signInWithPopup.mockRejectedValue(error);

    await expect(loginWithGoogle()).rejects.toBe(error);
  });
});

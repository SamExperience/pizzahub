import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onAuthStateChanged } from "firebase/auth";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { auth } from "../src/services/firebase";
import { getUserDB } from "../src/services/user.service";

vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));
vi.mock("../src/services/firebase", () => ({ auth: { currentUser: null } }));
vi.mock("../src/services/auth.service", () => ({
  register: vi.fn(),
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  signout: vi.fn(),
}));
vi.mock("../src/services/user.service", () => ({ getUserDB: vi.fn() }));

// A promise resolved by the test, to control when getUserDB answers.
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function Probe() {
  const { authUser, userProfile, loadingLogin, profileError, retryProfile } =
    useAuth();

  return (
    <div>
      <p>Loading: {String(loadingLogin)}</p>
      <p>Error: {profileError ? "yes" : "no"}</p>
      <button type="button" onClick={retryProfile}>
        Retry
      </button>
      <p>User: {authUser?.uid ?? "none"}</p>
      <p>Profile: {userProfile?.displayName ?? "none"}</p>
    </div>
  );
}

let emitAuth;

// Simulates Firebase: currentUser changes before the listener is called.
const signIn = (user) =>
  act(async () => {
    auth.currentUser = user;
    emitAuth(user);
  });

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.currentUser = null;
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      emitAuth = callback;
      return () => {};
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });

  afterEach(() => cleanup());

  it("stays loading while the profile of a signed-in user is read", async () => {
    await signIn(null);
    expect(screen.getByText("Loading: false")).toBeTruthy();

    const request = deferred();
    getUserDB.mockReturnValue(request.promise);
    await signIn({ uid: "u1" });

    expect(screen.getByText("Loading: true")).toBeTruthy();
    expect(screen.getByText("Profile: none")).toBeTruthy();

    await act(async () => request.resolve({ displayName: "Sam" }));

    expect(screen.getByText("Loading: false")).toBeTruthy();
    expect(screen.getByText("Profile: Sam")).toBeTruthy();
  });

  it("ignores the profile of a previous user after an account switch", async () => {
    const first = deferred();
    const second = deferred();
    getUserDB.mockImplementation((uid) =>
      uid === "u1" ? first.promise : second.promise,
    );

    await signIn({ uid: "u1" });
    await signIn({ uid: "u2" });
    await act(async () => second.resolve({ displayName: "Bea" }));
    await act(async () => first.resolve({ displayName: "Sam" }));

    expect(screen.getByText("User: u2")).toBeTruthy();
    expect(screen.getByText("Profile: Bea")).toBeTruthy();
    expect(screen.getByText("Loading: false")).toBeTruthy();
  });

  it("ignores a profile that arrives after logout", async () => {
    const request = deferred();
    getUserDB.mockReturnValue(request.promise);

    await signIn({ uid: "u1" });
    await signIn(null);
    await act(async () => request.resolve({ displayName: "Sam" }));

    expect(screen.getByText("User: none")).toBeTruthy();
    expect(screen.getByText("Profile: none")).toBeTruthy();
    expect(screen.getByText("Loading: false")).toBeTruthy();
  });

  it("ends loading with a profile error when it cannot be read", async () => {
    getUserDB.mockRejectedValue(new Error("offline"));

    await signIn({ uid: "u1" });

    expect(screen.getByText("Loading: false")).toBeTruthy();
    expect(screen.getByText("Profile: none")).toBeTruthy();
    expect(screen.getByText("Error: yes")).toBeTruthy();
  });

  it("reads the profile again on retry and clears the error", async () => {
    getUserDB.mockRejectedValueOnce(new Error("offline"));
    await signIn({ uid: "u1" });
    expect(screen.getByText("Error: yes")).toBeTruthy();

    getUserDB.mockResolvedValueOnce({ displayName: "Sam" });
    await act(async () => screen.getByText("Retry").click());

    expect(getUserDB).toHaveBeenLastCalledWith("u1");
    expect(screen.getByText("Error: no")).toBeTruthy();
    expect(screen.getByText("Profile: Sam")).toBeTruthy();
  });

  it("clears the profile error on logout", async () => {
    getUserDB.mockRejectedValue(new Error("offline"));
    await signIn({ uid: "u1" });
    await signIn(null);

    expect(screen.getByText("Error: no")).toBeTruthy();
  });
});

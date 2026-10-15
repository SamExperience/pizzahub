import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../src/pages/Login";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

vi.mock("../src/services/auth.service", () => mocks);

const fillLogin = (email, password) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
};

describe("Login", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("calls login with the entered email and password", async () => {
    mocks.login.mockResolvedValue({ uid: "u1" });
    render(<Login />);

    fillLogin("a@b.com", "secret1");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith("a@b.com", "secret1"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an inline error when login fails", async () => {
    mocks.login.mockRejectedValue({
      code: "auth/invalid-credential",
      message: "bad",
    });
    render(<Login />);

    fillLogin("a@b.com", "wrong-pass");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Invalid email or password.",
    );
  });

  it("switches to sign-up mode", () => {
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("flags mismatching passwords and disables submit", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "secret2" },
    });

    expect(screen.getByText("Passwords do not match")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create account" }).disabled,
    ).toBe(true);
  });

  it("shows no alert when the Google popup is closed", async () => {
    mocks.loginWithGoogle.mockRejectedValue({
      code: "auth/popup-closed-by-user",
      message: "closed",
    });
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Login with Google" }));

    await waitFor(() => expect(mocks.loginWithGoogle).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../src/pages/Login";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  loginWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
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

  it("disables both buttons while a login request is running", async () => {
    let resolveLogin;
    mocks.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    render(<Login />);

    fillLogin("a@b.com", "secret1");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    const submit = screen.getByRole("button", { name: "Log in" });
    const google = screen.getByRole("button", { name: "Login with Google" });
    expect(submit.disabled).toBe(true);
    expect(google.disabled).toBe(true);

    fireEvent.click(google);
    expect(mocks.loginWithGoogle).not.toHaveBeenCalled();

    resolveLogin({ uid: "u1" });
    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(mocks.login).toHaveBeenCalledTimes(1);
  });

  it("enables the buttons again after a failed Google login", async () => {
    mocks.loginWithGoogle.mockRejectedValue({
      code: "auth/network-request-failed",
      message: "offline",
    });
    render(<Login />);

    const google = screen.getByRole("button", { name: "Login with Google" });
    fireEvent.click(google);

    await screen.findByRole("alert");
    expect(google.disabled).toBe(false);
  });

  it("sends a password reset email for the typed email", async () => {
    mocks.resetPassword.mockResolvedValue(undefined);
    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect((await screen.findByRole("status")).textContent).toBe(
      "If an account exists for this email, we sent a password reset link.",
    );
    expect(mocks.resetPassword).toHaveBeenCalledWith("a@b.com");
    expect(mocks.login).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an inline error when the password reset fails", async () => {
    mocks.resetPassword.mockRejectedValue({
      code: "auth/missing-email",
      message: "missing",
    });
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enter your email address.",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides the password reset link in sign-up mode", () => {
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      screen.queryByRole("button", { name: "Forgot password?" }),
    ).toBeNull();
  });

  it("disables the buttons while a password reset request is running", async () => {
    let resolveReset;
    mocks.resetPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );
    render(<Login />);

    const reset = screen.getByRole("button", { name: "Forgot password?" });
    fireEvent.click(reset);

    expect(reset.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Log in" }).disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: "Login with Google" }).disabled,
    ).toBe(true);

    resolveReset();
    await screen.findByRole("status");
    expect(reset.disabled).toBe(false);
    expect(mocks.resetPassword).toHaveBeenCalledTimes(1);
  });
});

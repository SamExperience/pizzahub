import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogoutButton from "../src/components/LogoutButton";
import { useAuth } from "../src/contexts/AuthContext";

vi.mock("../src/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

describe("LogoutButton", () => {
  const logout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    useAuth.mockReturnValue({ logout });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("is disabled while the logout is running", async () => {
    let resolveLogout;
    logout.mockReturnValue(
      new Promise((resolve) => {
        resolveLogout = resolve;
      }),
    );
    render(<LogoutButton />);

    const button = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(button);
    expect(button.disabled).toBe(true);

    resolveLogout();
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("shows an error when the logout fails", async () => {
    logout.mockRejectedValue(new Error("offline"));
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Logout failed",
    );
  });
});

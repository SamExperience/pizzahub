import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useStore } from "../src/contexts/StoreContext";
import AppLayout from "../src/components/AppLayout";

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../src/contexts/StoreContext", () => ({
  useStore: vi.fn(),
}));

const billing = vi.hoisted(() => ({ subscribe: vi.fn() }));

vi.mock("../src/services/billing.service", async (importOriginal) => ({
  ...(await importOriginal()),
  subscribeToSubscription: billing.subscribe,
}));

const BANNER_TEXT = "Your subscription is not active.";

// The listener reports this subscription synchronously.
const emitting = (subscription) =>
  billing.subscribe.mockImplementation((companyId, onChange) => {
    onChange(subscription);
    return () => {};
  });

const logout = vi.fn();

function renderShell(path) {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: ["/stores", "/tableau", "/menu", "/dashboard"].map((p) => ({
          path: p,
          element: <p>page {p}</p>,
        })),
      },
    ],
    { initialEntries: [path] },
  );

  return render(<RouterProvider router={router} />);
}

describe("App shell", () => {
  beforeEach(() => {
    cleanup();
    logout.mockReset();
    useAuth.mockReturnValue({
      authUser: { email: "sam@example.com" },
      userProfile: { displayName: "Sam" },
      logout,
    });
    useStore.mockReturnValue({ selectedStore: { id: "s1", name: "Napoli" }, menuReady: true });
    billing.subscribe.mockReset();
    emitting({ status: "active" });
  });

  it("shows the active store and the user display name", () => {
    renderShell("/tableau");

    expect(screen.getAllByText("Napoli").length).toBeGreaterThan(0);
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.queryByText(/Company Name/)).toBeNull();
    expect(screen.queryByText(/John Doe/)).toBeNull();
  });

  it("falls back to the email when there is no display name", () => {
    useAuth.mockReturnValue({
      authUser: { email: "sam@example.com" },
      userProfile: null,
      logout,
    });

    renderShell("/tableau");

    expect(screen.getByText("sam@example.com")).toBeTruthy();
  });

  it("renders the main links and marks the active one", () => {
    renderShell("/menu");

    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Stores", "Tableau", "Menu", "Dashboard"]) {
      expect(nav.querySelector(`a[href="/${name.toLowerCase()}"]`)).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "Menu" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Tableau" }).getAttribute("aria-current")).toBeNull();
  });

  it("toggles the mobile menu", async () => {
    const user = userEvent.setup();
    renderShell("/tableau");

    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(1);

    await user.click(toggle);

    const opened = screen.getByRole("button", { name: "Close menu" });
    expect(opened.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(2);

    await user.click(opened);
    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the mobile menu after navigating", async () => {
    const user = userEvent.setup();
    renderShell("/tableau");

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getAllByRole("link", { name: "Dashboard" })[1]);

    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
    expect(screen.getByText("page /dashboard")).toBeTruthy();
  });

  it("uses the minimal layout on /stores", () => {
    renderShell("/stores");

    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    expect(screen.queryByRole("button", { name: /menu/i })).toBeNull();
    expect(screen.queryByText("Napoli")).toBeNull();
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
  });

  it("calls logout when clicking Logout", async () => {
    const user = userEvent.setup();
    renderShell("/stores");

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  describe("subscription banner", () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        authUser: { email: "sam@example.com" },
        userProfile: { displayName: "Sam", companyId: "company-1" },
        logout,
      });
    });

    it.each([
      ["there is no subscription", null],
      ["the subscription is not active", { status: "canceled" }],
    ])("is shown with a link to the subscription when %s", (_, subscription) => {
      emitting(subscription);

      renderShell("/tableau");

      expect(billing.subscribe.mock.calls[0][0]).toBe("company-1");
      expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Manage subscription" }).getAttribute("href"),
      ).toBe("/dashboard?section=subscription");
    });

    it("is hidden when the subscription is active", () => {
      renderShell("/tableau");

      expect(screen.queryByText(BANNER_TEXT)).toBeNull();
    });

    it("is hidden while loading", () => {
      billing.subscribe.mockImplementation(() => () => {});

      renderShell("/tableau");

      expect(screen.queryByText(BANNER_TEXT)).toBeNull();
    });

    it("is hidden when the subscription cannot be read", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      billing.subscribe.mockImplementation((companyId, onChange, onError) => {
        onError(new Error("denied"));
        return () => {};
      });

      renderShell("/tableau");

      expect(screen.queryByText(BANNER_TEXT)).toBeNull();
    });

    it("is not shown until the Menu is ready", () => {
      useStore.mockReturnValue({ selectedStore: { id: "s1", name: "Napoli" }, menuReady: false });
      emitting(null);

      renderShell("/menu");

      expect(screen.queryByText(BANNER_TEXT)).toBeNull();
      expect(billing.subscribe).not.toHaveBeenCalled();
    });

    it("is not shown in the minimal layout", () => {
      emitting(null);

      renderShell("/stores");

      expect(screen.queryByText(BANNER_TEXT)).toBeNull();
      expect(billing.subscribe).not.toHaveBeenCalled();
    });
  });
});

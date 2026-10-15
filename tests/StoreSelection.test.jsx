import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import StoreSelection from "../src/pages/StoreSelection";
import { useStore } from "../src/contexts/StoreContext";

vi.mock("../src/contexts/StoreContext", () => ({ useStore: vi.fn() }));

const baseStore = {
  accessibleStore: null,
  loadingStore: false,
  errorStore: null,
  fetchAccesibleStore: vi.fn(),
  menuReady: null,
  setselectedStore: vi.fn(),
};

const renderPage = (state) => {
  useStore.mockReturnValue({ ...baseStore, ...state });
  render(
    <MemoryRouter>
      <StoreSelection />
    </MemoryRouter>,
  );
};

describe("StoreSelection states", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows the loading state while the Store is read", () => {
    renderPage({ loadingStore: true });

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("No store found for your account.")).toBeNull();
  });

  it("shows an error with retry when the Store cannot be read", () => {
    renderPage({ errorStore: new Error("offline") });

    screen.getByRole("button", { name: "Try again" }).click();

    expect(screen.getByText("Unable to load your store.")).toBeTruthy();
    expect(baseStore.fetchAccesibleStore).toHaveBeenCalled();
    expect(screen.queryByText("No store found for your account.")).toBeNull();
  });

  it("shows an empty state when no Store is accessible", () => {
    renderPage({});

    expect(screen.getByText("No store found for your account.")).toBeTruthy();
  });

  it("shows the Store card when a Store is accessible", () => {
    renderPage({ accessibleStore: { id: "s1", name: "Pizza Roma" } });

    expect(screen.getByText("Pizza Roma")).toBeTruthy();
    expect(screen.queryByText("No store found for your account.")).toBeNull();
  });
});

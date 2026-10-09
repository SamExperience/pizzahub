import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreProvider, useStore } from "../src/contexts/StoreContext";
import { useAuth } from "../src/contexts/AuthContext";
import { isMenuReady } from "../src/services/menu.service";
import { getAccessibleStore } from "../src/services/store.service";

vi.mock("../src/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../src/services/menu.service", () => ({ isMenuReady: vi.fn() }));
vi.mock("../src/services/store.service", () => ({
  getAccessibleStore: vi.fn(),
}));

const store = { id: "store-1", name: "Pizza Roma" };
const KEY = "pizzahub.selectedStoreId";

function Probe() {
  const { selectedStore, setselectedStore, accessibleStore } = useStore();

  return (
    <div>
      <p>Selected: {selectedStore?.name ?? "none"}</p>
      <button type="button" onClick={() => setselectedStore(accessibleStore)}>
        Select
      </button>
      <button type="button" onClick={() => setselectedStore(null)}>
        Clear
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );

describe("StoreProvider active Store persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    localStorage.clear();
    useAuth.mockReturnValue({
      authUser: { uid: "u1" },
      loadingLogin: false,
      userProfile: { id: "u1" },
    });
    getAccessibleStore.mockResolvedValue(store);
    isMenuReady.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not select a Store on its own", async () => {
    renderProvider();

    await waitFor(() => expect(getAccessibleStore).toHaveBeenCalled());
    expect(screen.getByText("Selected: none")).toBeTruthy();
  });

  it("saves the Store id when it is selected", async () => {
    renderProvider();

    await userEvent.click(await screen.findByRole("button", { name: "Select" }));

    expect(await screen.findByText("Selected: Pizza Roma")).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBe("store-1");
  });

  it("restores the saved Store after a reload", async () => {
    localStorage.setItem(KEY, "store-1");

    renderProvider();

    expect(await screen.findByText("Selected: Pizza Roma")).toBeTruthy();
  });

  it("ignores a saved id that is not the accessible Store", async () => {
    localStorage.setItem(KEY, "other-store");

    renderProvider();

    await waitFor(() => expect(getAccessibleStore).toHaveBeenCalled());
    expect(screen.getByText("Selected: none")).toBeTruthy();
  });

  it("forgets the saved Store when the selection is cleared", async () => {
    localStorage.setItem(KEY, "store-1");

    renderProvider();
    await screen.findByText("Selected: Pizza Roma");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(localStorage.getItem(KEY)).toBeNull();
    expect(await screen.findByText("Selected: none")).toBeTruthy();
  });

  it("forgets the saved Store when the user is logged out", async () => {
    localStorage.setItem(KEY, "store-1");
    useAuth.mockReturnValue({
      authUser: null,
      loadingLogin: false,
      userProfile: null,
    });

    renderProvider();

    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
  });

  it("still works when the storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    renderProvider();
    await userEvent.click(await screen.findByRole("button", { name: "Select" }));

    expect(await screen.findByText("Selected: Pizza Roma")).toBeTruthy();
  });
});

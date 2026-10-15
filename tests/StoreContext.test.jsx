import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
  const {
    selectedStore,
    setselectedStore,
    accessibleStore,
    menuReady,
    menuReadyError,
    refreshMenuReady,
  } = useStore();

  return (
    <div>
      <p>Menu ready: {String(menuReady)}</p>
      <p>Menu error: {menuReadyError ? "yes" : "no"}</p>
      <button type="button" onClick={refreshMenuReady}>
        Check menu
      </button>
      <p>Selected: {selectedStore?.name ?? "none"}</p>
      <button type="button" onClick={() => setselectedStore(accessibleStore)}>
        Select
      </button>
      <button type="button" onClick={() => setselectedStore(null)}>
        Clear
      </button>
      <button
        type="button"
        onClick={() => setselectedStore({ id: "other", name: "Other" })}
      >
        Select other
      </button>
      <p>Accessible: {accessibleStore?.name ?? "none"}</p>
    </div>
  );
}

// A new element on every call, so rerender() runs useAuth() again.
const tree = () => (
  <StoreProvider>
    <Probe />
  </StoreProvider>
);

const renderProvider = () => render(tree());

const signedIn = (uid) => ({
  authUser: { uid },
  loadingLogin: false,
  userProfile: { id: uid },
});

describe("StoreProvider active Store persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
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

describe("StoreProvider account switch and selection validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.clear();
    useAuth.mockReturnValue(signedIn("u1"));
    isMenuReady.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("ignores the Store of a previous user that arrives late", async () => {
    let resolveFirst;
    getAccessibleStore.mockImplementation((uid) =>
      uid === "u1"
        ? new Promise((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve({ id: "store-2", name: "Pizza Milano" }),
    );

    const { rerender } = renderProvider();
    useAuth.mockReturnValue(signedIn("u2"));
    rerender(tree());

    expect(await screen.findByText("Accessible: Pizza Milano")).toBeTruthy();
    await act(async () => resolveFirst(store));
    expect(screen.getByText("Accessible: Pizza Milano")).toBeTruthy();
  });

  it("ignores a Store that arrives after logout", async () => {
    let resolveStore;
    getAccessibleStore.mockReturnValue(
      new Promise((resolve) => {
        resolveStore = resolve;
      }),
    );

    const { rerender } = renderProvider();
    useAuth.mockReturnValue({
      authUser: null,
      loadingLogin: false,
      userProfile: null,
    });
    rerender(tree());
    await act(async () => resolveStore(store));

    expect(screen.getByText("Accessible: none")).toBeTruthy();
  });

  it("refuses a Store that is not the accessible one", async () => {
    getAccessibleStore.mockResolvedValue(store);
    renderProvider();

    await screen.findByText("Accessible: Pizza Roma");
    await userEvent.click(screen.getByRole("button", { name: "Select other" }));

    expect(screen.getByText("Selected: none")).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("drops the selection when the accessible Store changes", async () => {
    getAccessibleStore.mockResolvedValue(store);
    const { rerender } = renderProvider();
    await userEvent.click(await screen.findByRole("button", { name: "Select" }));
    await screen.findByText("Selected: Pizza Roma");

    getAccessibleStore.mockResolvedValue({ id: "store-2", name: "Pizza Milano" });
    useAuth.mockReturnValue(signedIn("u2"));
    rerender(tree());

    expect(await screen.findByText("Accessible: Pizza Milano")).toBeTruthy();
    expect(screen.getByText("Selected: none")).toBeTruthy();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("reports a failed readiness check instead of a not-ready Menu", async () => {
    getAccessibleStore.mockResolvedValue(store);
    isMenuReady.mockRejectedValueOnce(new Error("offline"));
    localStorage.setItem(KEY, store.id);
    renderProvider();

    await screen.findByText("Menu error: yes");
    expect(screen.getByText("Menu ready: null")).toBeTruthy();

    await userEvent.click(screen.getByText("Check menu"));

    await screen.findByText("Menu ready: true");
    expect(screen.getByText("Menu error: no")).toBeTruthy();
  });
});

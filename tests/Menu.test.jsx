import { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Menu from "../src/pages/Menu";
import { useStore } from "../src/contexts/StoreContext";
import { getCategoriesByMenuId } from "../src/services/category.service";
import { createMenu, getMenuByStoreId } from "../src/services/menu.service";

vi.mock("../src/contexts/StoreContext", () => ({
  useStore: vi.fn(),
}));

vi.mock("../src/services/menu.service", () => ({
  getMenuByStoreId: vi.fn(),
  createMenu: vi.fn(),
}));

vi.mock("../src/services/category.service", () => ({
  getCategoriesByMenuId: vi.fn(),
}));

const store = { id: "store-1", name: "Pizza Roma" };

describe("Menu page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    useStore.mockReturnValue({ selectedStore: store });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a loading state first", () => {
    getMenuByStoreId.mockReturnValue(new Promise(() => {}));

    render(<Menu />);

    expect(screen.getByText("Loading ...")).toBeTruthy();
  });

  it("lists the categories of the existing Menu in order", async () => {
    getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue([
      { id: "c1", name: "Pizze", position: 1 },
      { id: "c2", name: "Bevande", position: 2 },
    ]);

    render(<Menu />);

    const items = await screen.findAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Pizze",
      "Bevande",
    ]);
    expect(createMenu).not.toHaveBeenCalled();
    expect(getCategoriesByMenuId).toHaveBeenCalledWith("menu-1");
  });

  it("creates the Menu once when the Store has none and shows the empty state", async () => {
    getMenuByStoreId.mockResolvedValue(null);
    createMenu.mockResolvedValue({ id: "menu-new" });
    getCategoriesByMenuId.mockResolvedValue([]);

    render(
      <StrictMode>
        <Menu />
      </StrictMode>,
    );

    expect(await screen.findByText("No categories yet.")).toBeTruthy();
    expect(createMenu).toHaveBeenCalledTimes(1);
    expect(createMenu).toHaveBeenCalledWith("store-1", "Pizza Roma");
    expect(getCategoriesByMenuId).toHaveBeenCalledWith("menu-new");
  });

  it("shows an error and retries the load", async () => {
    getMenuByStoreId
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue([
      { id: "c1", name: "Pizze", position: 1 },
    ]);

    render(<Menu />);

    await userEvent.click(await screen.findByText("Try again"));

    expect(await screen.findByText("Pizze")).toBeTruthy();
    expect(screen.queryByText("Unable to load the menu.")).toBeNull();
    expect(getMenuByStoreId).toHaveBeenCalledTimes(2);
  });
});

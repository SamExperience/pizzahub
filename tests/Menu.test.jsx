import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Menu from "../src/pages/Menu";
import { useStore } from "../src/contexts/StoreContext";
import {
  createCategory,
  deleteCategoryById,
  getCategoriesByMenuId,
  moveCategory,
  updateCategoryById,
} from "../src/services/category.service";
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
  createCategory: vi.fn(),
  updateCategoryById: vi.fn(),
  deleteCategoryById: vi.fn(),
  moveCategory: vi.fn(),
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

    await screen.findByText("Pizze");
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent.split(" ")[0])).toEqual([
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

  describe("category management", () => {
    const pizze = { id: "c1", name: "Pizze", position: 1 };
    const bevande = { id: "c2", name: "Bevande", position: 2 };

    const renderMenu = async (categories = [pizze, bevande]) => {
      getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
      getCategoriesByMenuId.mockResolvedValue(categories);
      render(<Menu />);
      await screen.findByLabelText("New category name");
    };

    it("creates a category at the last position and refreshes the list", async () => {
      await renderMenu();
      createCategory.mockResolvedValue({ id: "c3" });
      getCategoriesByMenuId.mockResolvedValue([
        pizze,
        bevande,
        { id: "c3", name: "Dolci", position: 3 },
      ]);

      await userEvent.type(screen.getByLabelText("New category name"), "Dolci");
      await userEvent.click(screen.getByText("Add category"));

      expect(await screen.findByText(/^Dolci/)).toBeTruthy();
      expect(createCategory).toHaveBeenCalledWith("menu-1", "Dolci", 3);
      expect(screen.getByLabelText("New category name").value).toBe("");
    });

    it("shows the service error and keeps the typed name", async () => {
      await renderMenu();
      createCategory.mockRejectedValue(new Error("Category name already exists"));

      await userEvent.type(screen.getByLabelText("New category name"), "Pizze");
      await userEvent.click(screen.getByText("Add category"));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Category name already exists",
      );
      expect(screen.getByLabelText("New category name").value).toBe("Pizze");
    });

    it("renames a category", async () => {
      await renderMenu();
      updateCategoryById.mockResolvedValue();
      getCategoriesByMenuId.mockResolvedValue([
        { ...pizze, name: "Pizze rosse" },
        bevande,
      ]);

      await userEvent.click(screen.getByLabelText("Edit Pizze"));
      const input = screen.getByLabelText("Category name");
      await userEvent.clear(input);
      await userEvent.type(input, "Pizze rosse");
      await userEvent.click(screen.getByText("Save"));

      expect(await screen.findByText(/^Pizze rosse/)).toBeTruthy();
      expect(updateCategoryById).toHaveBeenCalledWith("c1", {
        name: "Pizze rosse",
      });
    });

    it("cancels a rename without calling the service", async () => {
      await renderMenu();

      await userEvent.click(screen.getByLabelText("Edit Pizze"));
      await userEvent.click(screen.getByText("Cancel"));

      expect(updateCategoryById).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Edit Pizze")).toBeTruthy();
    });

    it("deletes a category only after confirmation", async () => {
      await renderMenu();
      deleteCategoryById.mockResolvedValue();
      const confirm = vi.spyOn(window, "confirm");

      confirm.mockReturnValueOnce(false);
      await userEvent.click(screen.getByLabelText("Delete Pizze"));
      expect(deleteCategoryById).not.toHaveBeenCalled();

      confirm.mockReturnValueOnce(true);
      getCategoriesByMenuId.mockResolvedValue([{ ...bevande, position: 1 }]);
      await userEvent.click(screen.getByLabelText("Delete Pizze"));

      await waitFor(() => expect(screen.queryByText(/^Pizze/)).toBeNull());
      expect(deleteCategoryById).toHaveBeenCalledWith("c1");
    });

    it("moves a category and refreshes the order", async () => {
      await renderMenu();
      moveCategory.mockResolvedValue();
      getCategoriesByMenuId.mockResolvedValue([
        { ...bevande, position: 1 },
        { ...pizze, position: 2 },
      ]);

      await userEvent.click(screen.getByLabelText("Move Bevande up"));

      await waitFor(() =>
        expect(
          screen
            .getAllByRole("listitem")
            .map((item) => item.textContent.split(" ")[0]),
        ).toEqual(["Bevande", "Pizze"]),
      );
      expect(moveCategory).toHaveBeenCalledWith("c2", "up");
    });

    it("disables moving up the first and down the last category", async () => {
      await renderMenu();

      expect(screen.getByLabelText("Move Pizze up").disabled).toBe(true);
      expect(screen.getByLabelText("Move Pizze down").disabled).toBe(false);
      expect(screen.getByLabelText("Move Bevande down").disabled).toBe(true);
    });
  });
});

import { StrictMode } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import {
  countProductsByCategoryId,
  getProductsByCategoryId,
} from "../src/services/product.service";

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

vi.mock("../src/services/product.service", () => ({
  countProductsByCategoryId: vi.fn(),
  getProductsByCategoryId: vi.fn(),
}));

const store = { id: "store-1", name: "Pizza Roma" };
const refreshMenuReady = vi.fn();

// Category names shown in the sidebar, top to bottom.
const categoryNames = () =>
  screen
    .getAllByRole("button", { name: /^Select / })
    .map((button) => button.getAttribute("aria-label").slice(7));

// Clicks a button of the open confirmation dialog.
const clickDialog = (name) =>
  userEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name }),
  );

describe("Menu page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    useStore.mockReturnValue({ selectedStore: store, refreshMenuReady });
    getProductsByCategoryId.mockResolvedValue([]);
    countProductsByCategoryId.mockResolvedValue(0);
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

    await screen.findByLabelText("Select Pizze");
    expect(categoryNames()).toEqual(["Pizze", "Bevande"]);
    expect(createMenu).not.toHaveBeenCalled();
    expect(getCategoriesByMenuId).toHaveBeenCalledWith("menu-1");
  });

  it("shows the product count of each category, capped at 99+", async () => {
    getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue([
      { id: "c1", name: "Pizze", position: 1 },
      { id: "c2", name: "Bevande", position: 2 },
    ]);
    countProductsByCategoryId.mockImplementation(async (categoryId) =>
      categoryId === "c1" ? 120 : 1,
    );

    render(<Menu />);

    const pizze = await screen.findByLabelText("Select Pizze");
    expect(within(pizze).getByText("99+")).toBeTruthy();
    expect(within(pizze).getByText("120 products")).toBeTruthy();
    const bevande = screen.getByLabelText("Select Bevande");
    expect(within(bevande).getByText("1")).toBeTruthy();
    expect(within(bevande).getByText("1 product")).toBeTruthy();
    expect(countProductsByCategoryId).toHaveBeenCalledWith("c1");
    expect(countProductsByCategoryId).toHaveBeenCalledWith("c2");
  });

  it("shows the load error when a product count fails", async () => {
    getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue([
      { id: "c1", name: "Pizze", position: 1 },
    ]);
    countProductsByCategoryId.mockRejectedValue(new Error("boom"));

    render(<Menu />);

    expect(await screen.findByText("Unable to load the menu.")).toBeTruthy();
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

    expect(await screen.findByLabelText("Select Pizze")).toBeTruthy();
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

      expect(await screen.findByLabelText("Select Dolci")).toBeTruthy();
      expect(createCategory).toHaveBeenCalledWith("menu-1", "Dolci", 3);
      expect(refreshMenuReady).toHaveBeenCalled();
      expect(screen.getByLabelText("New category name").value).toBe("");
    });

    it("runs one category change at a time and disables the controls meanwhile", async () => {
      await renderMenu();
      let resolveCreate;
      createCategory.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );

      await userEvent.type(screen.getByLabelText("New category name"), "Dolci");
      await userEvent.click(screen.getByText("Add category"));

      expect(screen.getByRole("button", { name: "Add category" }).disabled).toBe(true);
      expect(screen.getByLabelText("Delete Pizze").disabled).toBe(true);
      expect(screen.getByLabelText("Move Pizze down").disabled).toBe(true);
      expect(screen.getByText("Saving ...")).toBeTruthy();

      await userEvent.click(screen.getByLabelText("Move Pizze down"));
      expect(moveCategory).not.toHaveBeenCalled();

      resolveCreate({ id: "c3" });
      await waitFor(() =>
        expect(screen.getByLabelText("Delete Pizze").disabled).toBe(false),
      );
      expect(createCategory).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Saving ...")).toBeNull();
    });

    it("shows a generic message instead of a raw Firebase error", async () => {
      await renderMenu();
      createCategory.mockRejectedValue(
        Object.assign(new Error("Missing or insufficient permissions."), {
          code: "permission-denied",
        }),
      );

      await userEvent.type(screen.getByLabelText("New category name"), "Dolci");
      await userEvent.click(screen.getByText("Add category"));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Something went wrong. Please try again.",
      );
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

      expect(await screen.findByLabelText("Select Pizze rosse")).toBeTruthy();
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

      await userEvent.click(screen.getByLabelText("Delete Pizze"));
      await clickDialog("Keep");
      expect(deleteCategoryById).not.toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).toBeNull();

      getCategoriesByMenuId.mockResolvedValue([{ ...bevande, position: 1 }]);
      await userEvent.click(screen.getByLabelText("Delete Pizze"));
      await clickDialog("Delete category");

      await waitFor(() =>
      expect(screen.queryByLabelText("Select Pizze")).toBeNull(),
    );
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
        expect(categoryNames()).toEqual(["Bevande", "Pizze"]),
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

  describe("products of the selected category", () => {
    const pizze = { id: "c1", name: "Pizze", position: 1 };
    const bevande = { id: "c2", name: "Bevande", position: 2 };

    const renderMenu = async (categories = [pizze, bevande]) => {
      getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
      getCategoriesByMenuId.mockResolvedValue(categories);
      render(<Menu />);
      await screen.findByLabelText("New category name");
    };

    it("selects the first category automatically and loads its products", async () => {
      getProductsByCategoryId.mockResolvedValue([
        { id: "p1", name: "Margherita", price: 7, sizes: null },
      ]);

      await renderMenu();

      expect(await screen.findByText("Margherita")).toBeTruthy();
      expect(getProductsByCategoryId).toHaveBeenCalledWith("c1");
      expect(
        screen.getByLabelText("Select Pizze").getAttribute("aria-current"),
      ).toBe("true");
    });

    it("loads the products of another selected category", async () => {
      getProductsByCategoryId.mockImplementation(async (id) =>
        id === "c2" ? [{ id: "p2", name: "Cola", price: 3, sizes: null }] : [],
      );
      await renderMenu();

      await userEvent.click(screen.getByLabelText("Select Bevande"));

      expect(await screen.findByText("Cola")).toBeTruthy();
      expect(getProductsByCategoryId).toHaveBeenCalledWith("c2");
    });

    it("selects the first remaining category when the selected one is deleted", async () => {
      await renderMenu();
      deleteCategoryById.mockResolvedValue();
      getCategoriesByMenuId.mockResolvedValue([{ ...bevande, position: 1 }]);

      await userEvent.click(screen.getByLabelText("Delete Pizze"));
      await clickDialog("Delete category");

      await waitFor(() =>
        expect(getProductsByCategoryId).toHaveBeenLastCalledWith("c2"),
      );
      expect(
        screen.getByLabelText("Select Bevande").getAttribute("aria-current"),
      ).toBe("true");
    });

    it("asks to create a category when there are none", async () => {
      await renderMenu([]);

      expect(
        screen.getByText("Create a category to start adding products."),
      ).toBeTruthy();
      expect(getProductsByCategoryId).not.toHaveBeenCalled();
    });
  });
});

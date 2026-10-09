// Full Menu management flow through the real Menu page, ProductList,
// ProductForm and CategoryList. Only the service boundary is replaced by a
// small in-memory store, so each assertion checks what the UI shows after the
// data was written and reloaded.
import { cleanup, render, screen } from "@testing-library/react";
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
  createProduct,
  deleteProductById,
  deleteProductImage,
  getProductsByCategoryId,
  moveProductById,
  setProductAvailability,
  updateProductById,
  uploadProductImage,
} from "../src/services/product.service";

vi.mock("../src/contexts/StoreContext", () => ({ useStore: vi.fn() }));
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
  createProduct: vi.fn(),
  deleteProductById: vi.fn(),
  deleteProductImage: vi.fn(),
  getProductsByCategoryId: vi.fn(),
  moveProductById: vi.fn(),
  setProductAvailability: vi.fn(),
  updateProductById: vi.fn(),
  uploadProductImage: vi.fn(),
}));

const store = { id: "store-1", name: "Pizza Roma" };
const refreshMenuReady = vi.fn();

// In-memory persistence behind the mocked services.
let categories;
let products;
let nextId;

const byPosition = (a, b) => a.position - b.position;
const newId = (prefix) => `${prefix}-${nextId++}`;

// Swaps the position of an item with its neighbour in the given direction.
const swapWithNeighbour = (items, id, direction) => {
  const sorted = [...items].sort(byPosition);
  const index = sorted.findIndex((item) => item.id === id);
  const neighbour = sorted[direction === "up" ? index - 1 : index + 1];
  const item = sorted[index];
  [item.position, neighbour.position] = [neighbour.position, item.position];
};

const installFakeServices = () => {
  categories = [];
  products = [];
  nextId = 1;

  getMenuByStoreId.mockResolvedValue(null);
  createMenu.mockResolvedValue({ id: "menu-1" });

  getCategoriesByMenuId.mockImplementation(async () =>
    categories.map((category) => ({ ...category })).sort(byPosition),
  );
  createCategory.mockImplementation(async (menuId, name, position) => {
    categories.push({ id: newId("cat"), menuId, name, position });
  });
  updateCategoryById.mockImplementation(async (id, updates) => {
    Object.assign(categories.find((category) => category.id === id), updates);
  });
  moveCategory.mockImplementation(async (id, direction) =>
    swapWithNeighbour(categories, id, direction),
  );
  deleteCategoryById.mockImplementation(async (id) => {
    categories = categories.filter((category) => category.id !== id);
    products = products.filter((product) => product.categoryId !== id);
  });

  getProductsByCategoryId.mockImplementation(async (categoryId) =>
    products
      .filter((product) => product.categoryId === categoryId)
      .map((product) => ({ ...product }))
      .sort(byPosition),
  );
  createProduct.mockImplementation(async (categoryId, data) => {
    const product = { id: newId("prod"), categoryId, ...data };
    products.push(product);
    return { ...product };
  });
  updateProductById.mockImplementation(async (id, updates) => {
    Object.assign(products.find((product) => product.id === id), updates);
  });
  setProductAvailability.mockImplementation(async (id, isAvailable) => {
    products.find((product) => product.id === id).isAvailable = isAvailable;
  });
  moveProductById.mockImplementation(async (id, direction) => {
    const { categoryId } = products.find((product) => product.id === id);
    swapWithNeighbour(
      products.filter((product) => product.categoryId === categoryId),
      id,
      direction,
    );
  });
  deleteProductById.mockImplementation(async (id) => {
    products = products.filter((product) => product.id !== id);
  });
  uploadProductImage.mockResolvedValue("https://storage.test/pizza.jpg");
  deleteProductImage.mockResolvedValue();
};

const addCategory = async (name) => {
  await userEvent.type(screen.getByLabelText("New category name"), name);
  await userEvent.click(screen.getByRole("button", { name: "Add category" }));
  await screen.findByRole("button", { name: `Select ${name}` });
};

const addProduct = async (name, price) => {
  await userEvent.click(await screen.findByText("Add product"));
  await userEvent.type(screen.getByLabelText("Name"), name);
  await userEvent.type(screen.getByLabelText("Price"), price);
  await userEvent.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText(name);
};

// Names of the products shown, top to bottom.
const productNames = () =>
  screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector("strong")?.textContent)
    .filter(Boolean);

describe("Menu management through the UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    useStore.mockReturnValue({ selectedStore: store, refreshMenuReady });
    installFakeServices();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates the Menu on first access and starts empty", async () => {
    render(<Menu />);

    expect(await screen.findByText("No categories yet.")).toBeTruthy();
    expect(
      screen.getByText("Create a category to start adding products."),
    ).toBeTruthy();
    expect(createMenu).toHaveBeenCalledTimes(1);
  });

  it("manages categories: create, reorder, rename and delete", async () => {
    render(<Menu />);
    await screen.findByText("No categories yet.");

    await addCategory("Pizze");
    await addCategory("Bibite");
    await addCategory("Dolci");

    const names = () =>
      screen
        .getAllByRole("button", { name: /^Select / })
        .map((button) => button.textContent);
    expect(names()).toEqual(["Pizze", "Bibite", "Dolci"]);

    await userEvent.click(screen.getByRole("button", { name: "Move Dolci up" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Dolci up" }));
    await vi.waitFor(() => expect(names()).toEqual(["Dolci", "Pizze", "Bibite"]));

    await userEvent.click(screen.getByRole("button", { name: "Edit Pizze" }));
    const input = screen.getByLabelText("Category name");
    await userEvent.clear(input);
    await userEvent.type(input, "Pizze rosse");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(names()).toEqual(["Dolci", "Pizze rosse", "Bibite"]),
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete Dolci" }));
    await vi.waitFor(() => expect(names()).toEqual(["Pizze rosse", "Bibite"]));
    expect(refreshMenuReady).toHaveBeenCalled();
  });

  it("manages products: add, edit, toggle availability, reorder and delete", async () => {
    render(<Menu />);
    await screen.findByText("No categories yet.");
    await addCategory("Pizze");
    expect(await screen.findByText("No products in this category yet.")).toBeTruthy();

    await addProduct("Margherita", "7");
    await addProduct("Diavola", "9.5");
    expect(productNames()).toEqual(["Margherita", "Diavola"]);
    expect(screen.getByText(/€9\.50/)).toBeTruthy();

    // Sizes, ingredients and cooking levels.
    await userEvent.click(screen.getByText("Add product"));
    await userEvent.type(screen.getByLabelText("Name"), "Capricciosa");
    await userEvent.click(screen.getByRole("button", { name: "Add size" }));
    await userEvent.type(screen.getByLabelText("Size 1 name"), "Small");
    await userEvent.type(screen.getByLabelText("Size 1 price"), "8");
    await userEvent.click(screen.getByRole("button", { name: "Add size" }));
    await userEvent.type(screen.getByLabelText("Size 2 name"), "Large");
    await userEvent.type(screen.getByLabelText("Size 2 price"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
    await userEvent.type(screen.getByLabelText("Ingredient 1"), "ham");
    await userEvent.click(
      screen.getByRole("button", { name: "Add cooking level" }),
    );
    await userEvent.type(screen.getByLabelText("Cooking level 1"), "Well done");
    await userEvent.selectOptions(
      screen.getByLabelText("Default cooking level"),
      "Well done",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));

    expect(await screen.findByText(/Small: €8\.00 · Large: €12\.00/)).toBeTruthy();
    expect(screen.getByText("Ingredients: ham")).toBeTruthy();
    expect(createProduct).toHaveBeenLastCalledWith(
      "cat-1",
      expect.objectContaining({
        price: null,
        sizes: [
          { name: "Small", price: 8 },
          { name: "Large", price: 12 },
        ],
        availableCookingLevels: ["Well done"],
        defaultCookingLevel: "Well done",
        position: 3,
      }),
    );

    // Edit.
    await userEvent.click(screen.getByRole("button", { name: "Edit Diavola" }));
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Diavola piccante");
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(await screen.findByText("Diavola piccante")).toBeTruthy();

    // Availability.
    await userEvent.click(
      screen.getByRole("button", { name: "Mark unavailable Margherita" }),
    );
    expect(await screen.findByText("Unavailable")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Mark available Margherita" }),
    );
    await vi.waitFor(() => expect(screen.queryByText("Unavailable")).toBeNull());

    // Reorder.
    await userEvent.click(
      screen.getByRole("button", { name: "Move Capricciosa up" }),
    );
    await vi.waitFor(() =>
      expect(productNames()).toEqual([
        "Margherita",
        "Capricciosa",
        "Diavola piccante",
      ]),
    );

    // Delete.
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Margherita" }),
    );
    await vi.waitFor(() =>
      expect(productNames()).toEqual(["Capricciosa", "Diavola piccante"]),
    );
    expect(refreshMenuReady).toHaveBeenCalled();
  });

  it("uploads and removes a product image", async () => {
    render(<Menu />);
    await screen.findByText("No categories yet.");
    await addCategory("Pizze");

    await userEvent.click(await screen.findByText("Add product"));
    await userEvent.type(screen.getByLabelText("Name"), "Margherita");
    await userEvent.type(screen.getByLabelText("Price"), "7");
    await userEvent.upload(
      screen.getByLabelText("Product image"),
      new File(["x"], "pizza.jpg", { type: "image/jpeg" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));

    const image = await screen.findByAltText("Margherita");
    expect(image.getAttribute("src")).toBe("https://storage.test/pizza.jpg");
    expect(uploadProductImage).toHaveBeenCalledWith(
      store.id,
      products[0].id,
      expect.any(File),
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Margherita" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove image" }));
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));

    await vi.waitFor(() => expect(screen.queryByAltText("Margherita")).toBeNull());
    expect(deleteProductImage).toHaveBeenCalledWith(
      "https://storage.test/pizza.jpg",
    );
  });

  it("keeps the products of each category separate and deletes them with their category", async () => {
    render(<Menu />);
    await screen.findByText("No categories yet.");
    await addCategory("Pizze");
    await addProduct("Margherita", "7");
    await addCategory("Bibite");

    await userEvent.click(screen.getByRole("button", { name: "Select Bibite" }));
    expect(await screen.findByText("No products in this category yet.")).toBeTruthy();
    expect(screen.queryByText("Margherita")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Select Pizze" }));
    expect(await screen.findByText("Margherita")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Delete Pizze" }));
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Select Pizze" }),
      ).toBeNull(),
    );
    expect(products).toHaveLength(0);
    // The remaining category becomes the selected one.
    expect(await screen.findByText("No products in this category yet.")).toBeTruthy();
  });

  it("shows service errors and keeps the data consistent", async () => {
    render(<Menu />);
    await screen.findByText("No categories yet.");
    await addCategory("Pizze");

    createProduct.mockRejectedValueOnce(new Error("Product name is required"));
    await userEvent.click(await screen.findByText("Add product"));
    await userEvent.type(screen.getByLabelText("Name"), "Margherita");
    await userEvent.type(screen.getByLabelText("Price"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Product name is required",
    );
    expect(screen.getByRole("button", { name: "Save product" })).toBeTruthy();
    expect(products).toHaveLength(0);

    // Retrying the same form succeeds once the service recovers.
    await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    expect(await screen.findByText("Margherita")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

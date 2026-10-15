import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MenuTableauPanel from "../src/components/MenuTableauPanel";
import { getCategoriesByMenuId } from "../src/services/category.service";
import { getMenuByStoreId } from "../src/services/menu.service";
import { getProductsByCategoryId } from "../src/services/product.service";

vi.mock("../src/services/firebase", () => ({ db: {} }));
vi.mock("../src/services/menu.service", () => ({ getMenuByStoreId: vi.fn() }));
vi.mock("../src/services/category.service", () => ({
  getCategoriesByMenuId: vi.fn(),
}));
vi.mock("../src/services/product.service", () => ({
  getProductsByCategoryId: vi.fn(),
}));

const CATEGORIES = [
  { id: "cat1", name: "Pizzas" },
  { id: "cat2", name: "Drinks" },
];
const PIZZAS = [
  { id: "p1", name: "Margherita", price: 6, isAvailable: true },
  {
    id: "p2",
    name: "Diavola",
    price: null,
    sizes: [
      { name: "Medium", price: 9 },
      { name: "Large", price: 12 },
    ],
    isAvailable: true,
  },
  { id: "p3", name: "Capricciosa", price: 8, isAvailable: false },
];
const DRINKS = [{ id: "p4", name: "Cola", price: 2.5, isAvailable: true }];

const renderPanel = (props = {}) =>
  render(
    <MenuTableauPanel
      storeId="store-1"
      onSelectProduct={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe("MenuTableauPanel", () => {
  beforeEach(() => {
    getMenuByStoreId.mockResolvedValue({ id: "menu-1" });
    getCategoriesByMenuId.mockResolvedValue(CATEGORIES);
    getProductsByCategoryId.mockImplementation(async (categoryId) =>
      categoryId === "cat1" ? PIZZAS : DRINKS,
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads the Store's categories and shows the first category's products", async () => {
    renderPanel();

    expect(await screen.findByText("Margherita")).toBeTruthy();
    expect(getMenuByStoreId).toHaveBeenCalledWith("store-1");
    expect(getCategoriesByMenuId).toHaveBeenCalledWith("menu-1");
    expect(getProductsByCategoryId).toHaveBeenCalledWith("cat1");
    expect(screen.getByRole("button", { name: "Pizzas" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("€6.00")).toBeTruthy();
    expect(screen.getByText("From €9.00")).toBeTruthy();
  });

  it("loads the products of the category picked in the sidebar", async () => {
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Drinks" }));

    expect(await screen.findByText("Cola")).toBeTruthy();
    expect(getProductsByCategoryId).toHaveBeenCalledWith("cat2");
    expect(screen.queryByText("Margherita")).toBeNull();
  });

  it("disables unavailable products and selects the available ones", async () => {
    const onSelectProduct = vi.fn();
    renderPanel({ onSelectProduct });

    const unavailable = (await screen.findByText("Capricciosa")).closest("button");
    await userEvent.click(unavailable);

    expect(unavailable.disabled).toBe(true);
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(onSelectProduct).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText("Margherita"));

    expect(onSelectProduct).toHaveBeenCalledWith(PIZZAS[0]);
  });

  it("shows an error and retries loading the menu", async () => {
    getMenuByStoreId.mockRejectedValueOnce(new Error("boom"));
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Margherita")).toBeTruthy();
    expect(getMenuByStoreId).toHaveBeenCalledTimes(2);
  });

  it("shows an error and retries loading the products", async () => {
    getProductsByCategoryId.mockRejectedValueOnce(new Error("boom"));
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Margherita")).toBeTruthy();
    expect(getProductsByCategoryId).toHaveBeenCalledTimes(2);
  });

  it("shows empty states for a menu without categories and a category without products", async () => {
    getCategoriesByMenuId.mockResolvedValueOnce([]);
    renderPanel();

    expect(await screen.findByText("No categories in the menu.")).toBeTruthy();

    cleanup();
    getProductsByCategoryId.mockResolvedValueOnce([]);
    renderPanel();

    expect(await screen.findByText("No products in this category yet.")).toBeTruthy();
  });

  it("closes from the close button and Escape", async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await userEvent.click(await screen.findByRole("button", { name: "Close menu" }));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("recalls the ticket content in the Done button, which closes the panel", async () => {
    const onClose = vi.fn();
    renderPanel({ onClose, itemCount: 3, total: 21.5 });

    await userEvent.click(
      await screen.findByRole("button", { name: "Done · 3 items · €21.50" }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

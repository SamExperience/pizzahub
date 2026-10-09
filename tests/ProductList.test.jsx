import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductList from "../src/components/ProductList";
import {
  createProduct,
  getProductsByCategoryId,
} from "../src/services/product.service";

vi.mock("../src/services/product.service", () => ({
  createProduct: vi.fn(),
  getProductsByCategoryId: vi.fn(),
}));

describe("ProductList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a loading state first", () => {
    getProductsByCategoryId.mockReturnValue(new Promise(() => {}));

    render(<ProductList categoryId="c1" categoryName="Pizze" />);

    expect(screen.getByText("Loading ...")).toBeTruthy();
    expect(screen.getByText("Pizze")).toBeTruthy();
  });

  it("lists the products in the order returned by the service", async () => {
    getProductsByCategoryId.mockResolvedValue([
      { id: "p1", name: "Margherita", price: 7, sizes: null },
      { id: "p2", name: "Diavola", price: 9.5, sizes: null },
    ]);

    render(<ProductList categoryId="c1" categoryName="Pizze" />);

    await screen.findByText("Margherita");
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Margherita €7.00", "Diavola €9.50"]);
    expect(getProductsByCategoryId).toHaveBeenCalledWith("c1");
  });

  it("shows one price per size when the product has sizes", async () => {
    getProductsByCategoryId.mockResolvedValue([
      {
        id: "p1",
        name: "Margherita",
        price: null,
        sizes: [
          { name: "Small", price: 6 },
          { name: "Large", price: 9 },
        ],
      },
    ]);

    render(<ProductList categoryId="c1" categoryName="Pizze" />);

    expect(
      await screen.findByText(/Small: €6\.00 · Large: €9\.00/),
    ).toBeTruthy();
  });

  it("marks unavailable products and shows the description", async () => {
    getProductsByCategoryId.mockResolvedValue([
      {
        id: "p1",
        name: "Margherita",
        price: 7,
        sizes: null,
        isAvailable: false,
        description: "Tomato and mozzarella",
      },
    ]);

    render(<ProductList categoryId="c1" categoryName="Pizze" />);

    expect(await screen.findByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("Tomato and mozzarella")).toBeTruthy();
  });

  it("shows the ingredients when the product has them", async () => {
    getProductsByCategoryId.mockResolvedValue([
      {
        id: "p1",
        name: "Margherita",
        price: 7,
        sizes: null,
        ingredients: ["tomato", "mozzarella"],
      },
      { id: "p2", name: "Diavola", price: 9, sizes: null, ingredients: null },
    ]);

    render(<ProductList categoryId="c1" categoryName="Pizze" />);

    expect(
      await screen.findByText("Ingredients: tomato, mozzarella"),
    ).toBeTruthy();
    expect(screen.getAllByText(/Ingredients:/)).toHaveLength(1);
  });

  it("shows the empty state", async () => {
    getProductsByCategoryId.mockResolvedValue([]);

    render(<ProductList categoryId="c1" categoryName="Pizze" />);

    expect(
      await screen.findByText("No products in this category yet."),
    ).toBeTruthy();
  });

  it("shows an error and retries the load", async () => {
    getProductsByCategoryId
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([
        { id: "p1", name: "Margherita", price: 7, sizes: null },
      ]);

    render(<ProductList categoryId="c1" categoryName="Pizze" />);

    await userEvent.click(await screen.findByText("Try again"));

    expect(await screen.findByText("Margherita")).toBeTruthy();
    expect(screen.queryByText(/Unable to load the products/)).toBeNull();
    expect(getProductsByCategoryId).toHaveBeenCalledTimes(2);
  });

  describe("adding a product", () => {
    const existing = [
      { id: "p1", name: "Margherita", price: 7, sizes: null, position: 1 },
      { id: "p2", name: "Diavola", price: 9.5, sizes: null, position: 2 },
    ];

    const fillAndSave = async () => {
      await userEvent.click(await screen.findByText("Add product"));
      await userEvent.type(screen.getByLabelText("Name"), "Capricciosa");
      await userEvent.type(screen.getByLabelText("Price"), "10");
      await userEvent.click(screen.getByRole("button", { name: "Save product" }));
    };

    it("creates the product in the last position and refreshes the list", async () => {
      getProductsByCategoryId
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([
          ...existing,
          { id: "p3", name: "Capricciosa", price: 10, sizes: null },
        ]);
      createProduct.mockResolvedValue({ id: "p3" });

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await fillAndSave();

      expect(await screen.findByText("Capricciosa")).toBeTruthy();
      expect(createProduct).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          name: "Capricciosa",
          price: 10,
          sizes: null,
          isAvailable: true,
          position: 3,
        }),
      );
      expect(screen.queryByRole("button", { name: "Save product" })).toBeNull();
    });

    it("shows the service error and keeps the form open", async () => {
      getProductsByCategoryId.mockResolvedValue(existing);
      createProduct.mockRejectedValue(new Error("Product name is required"));

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await fillAndSave();

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Product name is required",
      );
      expect(screen.getByRole("button", { name: "Save product" })).toBeTruthy();
    });

    it("closes the form on cancel without creating anything", async () => {
      getProductsByCategoryId.mockResolvedValue(existing);

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(await screen.findByText("Add product"));
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("button", { name: "Save product" })).toBeNull();
      expect(createProduct).not.toHaveBeenCalled();
    });
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductList from "../src/components/ProductList";
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
    ).toEqual([
      expect.stringContaining("Margherita €7.00"),
      expect.stringContaining("Diavola €9.50"),
    ]);
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

  describe("managing a product", () => {
    const existing = [
      { id: "p1", name: "Margherita", price: 7, sizes: null, position: 1 },
      { id: "p2", name: "Diavola", price: 9.5, sizes: null, position: 2 },
    ];

    it("edits the product and refreshes the list", async () => {
      getProductsByCategoryId
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([
          { ...existing[0], name: "Marinara" },
          existing[1],
        ]);
      updateProductById.mockResolvedValue();

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit Margherita" }),
      );
      const nameInput = screen.getByLabelText("Name");
      expect(nameInput.value).toBe("Margherita");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Marinara");
      await userEvent.click(screen.getByRole("button", { name: "Save product" }));

      expect(await screen.findByText("Marinara")).toBeTruthy();
      expect(updateProductById).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ name: "Marinara", price: 7, sizes: null }),
      );
      expect(screen.queryByRole("button", { name: "Save product" })).toBeNull();
    });

    it("keeps the edit form open and shows the service error", async () => {
      getProductsByCategoryId.mockResolvedValue(existing);
      updateProductById.mockRejectedValue(new Error("Product name is required"));

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit Margherita" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Save product" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Product name is required",
      );
      expect(screen.getByRole("button", { name: "Save product" })).toBeTruthy();
    });

    it("closes the edit form on cancel without updating", async () => {
      getProductsByCategoryId.mockResolvedValue(existing);

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit Margherita" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("button", { name: "Save product" })).toBeNull();
      expect(updateProductById).not.toHaveBeenCalled();
    });

    it("deletes a confirmed product and refreshes the list", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      getProductsByCategoryId
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([existing[1]]);
      deleteProductById.mockResolvedValue();

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Margherita" }),
      );

      await waitFor(() => expect(screen.queryByText("Margherita")).toBeNull());
      expect(deleteProductById).toHaveBeenCalledWith("p1");
    });

    it("does not delete when the confirmation is declined", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      getProductsByCategoryId.mockResolvedValue(existing);

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Margherita" }),
      );

      expect(deleteProductById).not.toHaveBeenCalled();
      expect(screen.getByText("Margherita")).toBeTruthy();
    });

    it("shows the error when the deletion fails", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      getProductsByCategoryId.mockResolvedValue(existing);
      deleteProductById.mockRejectedValue(new Error("Product not found"));

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Delete Margherita" }),
      );

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Product not found",
      );
      expect(screen.getByText("Margherita")).toBeTruthy();
    });

    it("moves a product and refreshes the list", async () => {
      getProductsByCategoryId
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([existing[1], existing[0]]);
      moveProductById.mockResolvedValue();

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Move Diavola up" }),
      );

      await waitFor(() =>
        expect(
          screen.getAllByRole("listitem")[0].textContent,
        ).toContain("Diavola"),
      );
      expect(moveProductById).toHaveBeenCalledWith("p2", "up");
    });

    it("disables moving the first product up and the last one down", async () => {
      getProductsByCategoryId.mockResolvedValue(existing);

      render(<ProductList categoryId="c1" categoryName="Pizze" />);

      expect(
        (await screen.findByRole("button", { name: "Move Margherita up" }))
          .disabled,
      ).toBe(true);
      expect(
        screen.getByRole("button", { name: "Move Diavola down" }).disabled,
      ).toBe(true);
      expect(
        screen.getByRole("button", { name: "Move Margherita down" }).disabled,
      ).toBe(false);
    });

    it("shows the error when moving fails", async () => {
      getProductsByCategoryId.mockResolvedValue(existing);
      moveProductById.mockRejectedValue(new Error("Product not found"));

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Move Diavola up" }),
      );

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Product not found",
      );
    });

    it("toggles the availability to the opposite value", async () => {
      getProductsByCategoryId
        .mockResolvedValueOnce([{ ...existing[0], isAvailable: true }])
        .mockResolvedValueOnce([{ ...existing[0], isAvailable: false }]);
      setProductAvailability.mockResolvedValue();

      render(<ProductList categoryId="c1" categoryName="Pizze" />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Mark unavailable Margherita" }),
      );

      expect(await screen.findByText("Unavailable")).toBeTruthy();
      expect(setProductAvailability).toHaveBeenCalledWith("p1", false);
      expect(
        screen.getByRole("button", { name: "Mark available Margherita" }),
      ).toBeTruthy();
    });
  });

  describe("product images", () => {
    const withImage = [
      {
        id: "p1",
        name: "Margherita",
        price: 7,
        sizes: null,
        position: 1,
        imageUrl: "https://example.com/p1.png",
      },
    ];
    const file = new File(["x"], "pizza.png", { type: "image/png" });
    beforeEach(() => {
      createProduct.mockResolvedValue({ id: "p9" });
      updateProductById.mockResolvedValue(undefined);
    });

    const renderList = () =>
      render(<ProductList storeId="s1" categoryId="c1" categoryName="Pizze" />);

    it("shows the thumbnail of a product with an image", async () => {
      getProductsByCategoryId.mockResolvedValue(withImage);

      renderList();

      const image = await screen.findByAltText("Margherita");
      expect(image.getAttribute("src")).toBe("https://example.com/p1.png");
    });

    it("uploads the image after creating the product", async () => {
      getProductsByCategoryId.mockResolvedValue([]);
      createProduct.mockResolvedValue({ id: "p9" });
      uploadProductImage.mockResolvedValue("https://example.com/p9.png");

      renderList();
      await userEvent.click(
        await screen.findByRole("button", { name: "Add product" }),
      );
      await userEvent.type(screen.getByLabelText("Name"), "Diavola");
      await userEvent.type(screen.getByLabelText("Price"), "9");
      await userEvent.upload(screen.getByLabelText("Product image"), file);
      await userEvent.click(screen.getByRole("button", { name: "Save product" }));

      await waitFor(() =>
        expect(updateProductById).toHaveBeenCalledWith("p9", {
          imageUrl: "https://example.com/p9.png",
        }),
      );
      expect(createProduct.mock.calls[0][1]).not.toHaveProperty("imageFile");
      expect(uploadProductImage).toHaveBeenCalledWith("s1", "p9", file);
    });

    it("reloads the list when the image upload fails after the product was created", async () => {
      getProductsByCategoryId
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          { id: "p9", name: "Diavola", price: 9, sizes: null, position: 1 },
        ]);
      uploadProductImage.mockRejectedValue(new Error("Upload failed"));

      renderList();
      await userEvent.click(
        await screen.findByRole("button", { name: "Add product" }),
      );
      await userEvent.type(screen.getByLabelText("Name"), "Diavola");
      await userEvent.type(screen.getByLabelText("Price"), "9");
      await userEvent.upload(screen.getByLabelText("Product image"), file);
      await userEvent.click(screen.getByRole("button", { name: "Save product" }));

      expect(await screen.findByText("Upload failed")).toBeTruthy();
      expect(await screen.findByText("Diavola")).toBeTruthy();
    });

    it("replaces the image of an existing product", async () => {
      getProductsByCategoryId.mockResolvedValue(withImage);
      uploadProductImage.mockResolvedValue("https://example.com/new.png");

      renderList();
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit Margherita" }),
      );
      await userEvent.upload(screen.getByLabelText("Product image"), file);
      await userEvent.click(screen.getByRole("button", { name: "Save product" }));

      await waitFor(() =>
        expect(updateProductById).toHaveBeenCalledWith(
          "p1",
          expect.objectContaining({ imageUrl: "https://example.com/new.png" }),
        ),
      );
      expect(uploadProductImage).toHaveBeenCalledWith("s1", "p1", file);
      expect(deleteProductImage).not.toHaveBeenCalled();
    });

    it("clears the URL, then deletes the stored image on removal", async () => {
      getProductsByCategoryId.mockResolvedValue(withImage);

      renderList();
      await userEvent.click(
        await screen.findByRole("button", { name: "Edit Margherita" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Remove image" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Save product" }));

      await waitFor(() =>
        expect(deleteProductImage).toHaveBeenCalledWith(
          "https://example.com/p1.png",
        ),
      );
      expect(updateProductById).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ imageUrl: null }),
      );
      expect(uploadProductImage).not.toHaveBeenCalled();
    });
  });
});

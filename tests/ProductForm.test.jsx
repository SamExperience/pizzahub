import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductForm from "../src/components/ProductForm";

describe("ProductForm", () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  const renderForm = () =>
    render(<ProductForm onSubmit={onSubmit} onCancel={onCancel} />);

  const saveButton = () => screen.getByRole("button", { name: "Save product" });
  const click = (name) =>
    userEvent.click(screen.getByRole("button", { name }));

  const fillBasics = async (productName = "Steak", price = "15") => {
    await userEvent.type(screen.getByLabelText("Name"), productName);
    await userEvent.type(screen.getByLabelText("Price"), price);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("disables saving until a name and a valid price are entered", async () => {
    renderForm();
    expect(saveButton().disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Name"), "Margherita");
    expect(saveButton().disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Price"), "7");
    expect(saveButton().disabled).toBe(false);
  });

  it("submits a single-price product with empty lists as null", async () => {
    renderForm();

    await fillBasics("Margherita", "7.5");
    await click("Save product");

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Margherita",
      description: null,
      price: 7.5,
      sizes: null,
      ingredients: null,
      availableCookingLevels: null,
      defaultCookingLevel: null,
      isAvailable: true,
      imageFile: null,
      removeImage: false,
    });
  });

  it("switches to sizes when a size is added and back when removed", async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText("Name"), "Margherita");
    await click("Add size");
    expect(screen.queryByLabelText("Price")).toBeNull();

    await userEvent.type(screen.getByLabelText("Size 1 name"), "Small");
    await userEvent.type(screen.getByLabelText("Size 1 price"), "6");
    await click("Add size");
    await userEvent.type(screen.getByLabelText("Size 2 name"), "Large");
    await userEvent.type(screen.getByLabelText("Size 2 price"), "9");
    await click("Save product");

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        price: null,
        sizes: [
          { name: "Small", price: 6 },
          { name: "Large", price: 9 },
        ],
      }),
    );

    await click("Remove size 2");
    await click("Remove size 1");
    expect(screen.getByLabelText("Price")).toBeTruthy();
  });

  it("requires every size row to be complete", async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText("Name"), "Margherita");
    await click("Add size");
    await userEvent.type(screen.getByLabelText("Size 1 name"), "Small");
    expect(saveButton().disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Size 1 price"), "6");
    expect(saveButton().disabled).toBe(false);
  });

  it("adds, edits and removes ingredients, ignoring blank rows", async () => {
    renderForm();
    await fillBasics();

    await click("Add ingredient");
    await userEvent.type(screen.getByLabelText("Ingredient 1"), " beef ");
    await click("Add ingredient");
    await click("Add ingredient");
    await userEvent.type(screen.getByLabelText("Ingredient 3"), "salt");
    await click("Remove ingredient 1");
    await click("Add ingredient");
    await click("Save product");

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ ingredients: ["salt"] }),
    );
  });

  it("requires choosing a default once cooking levels are added", async () => {
    renderForm();
    await fillBasics();
    expect(screen.queryByLabelText("Default cooking level")).toBeNull();

    await click("Add cooking level");
    await userEvent.type(screen.getByLabelText("Cooking level 1"), "rare");
    await click("Add cooking level");
    await userEvent.type(screen.getByLabelText("Cooking level 2"), "medium");
    expect(saveButton().disabled).toBe(true);

    const select = screen.getByLabelText("Default cooking level");
    expect(
      Array.from(select.options).map((option) => option.textContent),
    ).toEqual(["Select a level", "rare", "medium"]);

    await userEvent.selectOptions(select, "medium");
    expect(saveButton().disabled).toBe(false);
    await click("Save product");

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        availableCookingLevels: ["rare", "medium"],
        defaultCookingLevel: "medium",
      }),
    );
  });

  it("asks for a new default when the chosen one is removed", async () => {
    renderForm();
    await fillBasics();

    await click("Add cooking level");
    await userEvent.type(screen.getByLabelText("Cooking level 1"), "rare");
    await click("Add cooking level");
    await userEvent.type(screen.getByLabelText("Cooking level 2"), "medium");
    await userEvent.selectOptions(
      screen.getByLabelText("Default cooking level"),
      "medium",
    );
    expect(saveButton().disabled).toBe(false);

    await click("Remove cooking level 2");
    expect(screen.getByLabelText("Default cooking level").value).toBe("");
    expect(saveButton().disabled).toBe(true);

    await userEvent.selectOptions(
      screen.getByLabelText("Default cooking level"),
      "rare",
    );
    expect(saveButton().disabled).toBe(false);
  });

  it("saves no levels and no default when all levels are removed", async () => {
    renderForm();
    await fillBasics();

    await click("Add cooking level");
    await userEvent.type(screen.getByLabelText("Cooking level 1"), "rare");
    await userEvent.selectOptions(
      screen.getByLabelText("Default cooking level"),
      "rare",
    );
    await click("Remove cooking level 1");
    expect(screen.queryByLabelText("Default cooking level")).toBeNull();
    await click("Save product");

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        availableCookingLevels: null,
        defaultCookingLevel: null,
      }),
    );
  });

  it("submits an unavailable product and the optional description", async () => {
    renderForm();

    await fillBasics("Diavola", "9");
    await userEvent.type(screen.getByLabelText("Description"), "Spicy");
    await userEvent.click(screen.getByLabelText("Available"));
    await click("Save product");

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Spicy", isAvailable: false }),
    );
  });

  it("calls onCancel", async () => {
    renderForm();

    await click("Cancel");

    expect(onCancel).toHaveBeenCalled();
  });

  describe("edit mode", () => {
    const renderEdit = (product) =>
      render(
        <ProductForm product={product} onSubmit={onSubmit} onCancel={onCancel} />,
      );

    it("starts from a single-price product and submits the changes", async () => {
      renderEdit({
        name: "Margherita",
        description: "Tomato",
        price: 7,
        sizes: null,
        ingredients: ["tomato"],
        availableCookingLevels: null,
        defaultCookingLevel: null,
        isAvailable: false,
      });

      expect(screen.getByLabelText("Name").value).toBe("Margherita");
      expect(screen.getByLabelText("Price").value).toBe("7");
      expect(screen.getByLabelText("Available").checked).toBe(false);
      expect(saveButton().disabled).toBe(false);

      await userEvent.clear(screen.getByLabelText("Price"));
      await userEvent.type(screen.getByLabelText("Price"), "8.5");
      await userEvent.click(saveButton());

      expect(onSubmit).toHaveBeenCalledWith({
        name: "Margherita",
        description: "Tomato",
        price: 8.5,
        sizes: null,
        ingredients: ["tomato"],
        availableCookingLevels: null,
        defaultCookingLevel: null,
        isAvailable: false,
        imageFile: null,
        removeImage: false,
      });
    });

    it("starts from a product with sizes and cooking levels", async () => {
      renderEdit({
        name: "Steak",
        description: null,
        price: null,
        sizes: [{ name: "Large", price: 20 }],
        ingredients: null,
        availableCookingLevels: ["rare", "well done"],
        defaultCookingLevel: "rare",
        isAvailable: true,
      });

      expect(screen.queryByLabelText("Price")).toBeNull();
      expect(screen.getByLabelText("Size 1 name").value).toBe("Large");
      expect(screen.getByLabelText("Size 1 price").value).toBe("20");
      expect(screen.getByLabelText("Default cooking level").value).toBe("rare");

      await userEvent.click(saveButton());

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          price: null,
          sizes: [{ name: "Large", price: 20 }],
          availableCookingLevels: ["rare", "well done"],
          defaultCookingLevel: "rare",
        }),
      );
    });

    it("disables saving when the edited data becomes invalid", async () => {
      renderEdit({ name: "Margherita", price: 7, sizes: null });

      await userEvent.clear(screen.getByLabelText("Name"));

      expect(saveButton().disabled).toBe(true);
    });

    it("shows the current image and submits its removal", async () => {
      renderEdit({
        name: "Margherita",
        price: 7,
        sizes: null,
        imageUrl: "https://example.com/p1.png",
      });

      expect(screen.getByAltText("Current product")).toBeTruthy();
      await userEvent.click(
        screen.getByRole("button", { name: "Remove image" }),
      );
      expect(screen.queryByAltText("Current product")).toBeNull();
      await userEvent.click(saveButton());

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ imageFile: null, removeImage: true }),
      );
    });

    it("submits a newly picked image file", async () => {
      renderEdit({ name: "Margherita", price: 7, sizes: null });
      const file = new File(["x"], "pizza.png", { type: "image/png" });

      await userEvent.upload(screen.getByLabelText("Product image"), file);
      await userEvent.click(saveButton());

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ imageFile: file, removeImage: false }),
      );
    });
  });
});

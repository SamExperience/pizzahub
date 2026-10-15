import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ItemConfigModal from "../src/components/ItemConfigModal";
import { FIELD_LIMITS } from "../src/utils/fieldLimits";

vi.mock("../src/services/firebase", () => ({ db: {} }));

const PIZZA = {
  id: "p1",
  name: "Margherita",
  price: null,
  sizes: [
    { name: "Small", price: 6 },
    { name: "Large", price: 10 },
  ],
  availableCookingLevels: ["Rare", "Medium", "Well done"],
  defaultCookingLevel: "Medium",
  isAvailable: true,
};

const WATER = {
  id: "p2",
  name: "Water",
  price: 2,
  sizes: null,
  availableCookingLevels: [],
  defaultCookingLevel: null,
  isAvailable: true,
};

const renderModal = (product, props = {}) => {
  const onAdd = vi.fn();
  const onClose = vi.fn();

  render(
    <ItemConfigModal product={product} onAdd={onAdd} onClose={onClose} {...props} />,
  );

  return { onAdd, onClose };
};

describe("ItemConfigModal", () => {
  afterEach(cleanup);

  it("starts with the size cards when the product has sizes", async () => {
    renderModal(PIZZA);

    expect(screen.getByRole("button", { name: /Small/ }).textContent).toContain("€6.00");
    expect(screen.getByRole("button", { name: /Large/ }).textContent).toContain("€10.00");
    expect(screen.queryByRole("button", { name: /Add to ticket/ })).toBeNull();
  });

  it("moves to the options after choosing a size and goes back", async () => {
    renderModal(PIZZA);

    await userEvent.click(screen.getByRole("button", { name: /Large/ }));

    expect(screen.getByRole("heading", { name: "Margherita · Large" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to ticket · €10.00" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Back to sizes" }));

    expect(screen.getByRole("button", { name: /Small/ })).toBeTruthy();
  });

  it("starts directly at the options when the product has no sizes", () => {
    renderModal(WATER);

    expect(screen.queryByRole("button", { name: "Back to sizes" })).toBeNull();
    expect(screen.queryByText("Cooking level")).toBeNull();
    expect(screen.getByRole("button", { name: "Add to ticket · €2.00" })).toBeTruthy();
  });

  it("preselects the default cooking level and lets it be changed", async () => {
    const { onAdd } = renderModal(PIZZA);

    await userEvent.click(screen.getByRole("button", { name: /Small/ }));

    expect(screen.getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: "Well done" }));
    await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));

    expect(onAdd.mock.calls[0][0].cookingLevel).toBe("Well done");
  });

  it("adds, trims and removes free-text customizations", async () => {
    const { onAdd } = renderModal(WATER);
    const field = screen.getByLabelText("Customizations");

    await userEvent.type(field, "  no ice  {Enter}");
    await userEvent.type(field, "lemon");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await userEvent.click(screen.getByRole("button", { name: "Add" })); // empty: ignored
    await userEvent.click(screen.getByRole("button", { name: "Remove lemon" }));
    await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));

    expect(onAdd.mock.calls[0][0].customizations).toEqual(["no ice"]);
  });

  it("adds a typed customization when the field loses focus", async () => {
    renderModal(WATER);

    await userEvent.type(screen.getByLabelText("Customizations"), "no ice");
    await userEvent.click(screen.getByText("Quantity"));

    expect(screen.getByRole("button", { name: "Remove no ice" })).toBeTruthy();
    expect(screen.getByLabelText("Customizations").value).toBe("");
  });

  it("keeps a typed customization that was not added when adding to the ticket", async () => {
    const { onAdd } = renderModal(WATER);

    await userEvent.type(screen.getByLabelText("Customizations"), "lemon{Enter}");
    await userEvent.type(screen.getByLabelText("Customizations"), " no ice ");
    await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0].customizations).toEqual(["lemon", "no ice"]);
  });

  it("keeps the focus in the customization field when a button is pressed", async () => {
    const { onAdd } = renderModal(WATER);
    const field = screen.getByLabelText("Customizations");

    await userEvent.type(field, "no ice");
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));

    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole("button", { name: "Remove no ice" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));

    expect(onAdd.mock.calls[0][0]).toMatchObject({ quantity: 2, customizations: ["no ice"] });
  });

  it("changes the quantity (minimum 1) and updates the line total", async () => {
    const { onAdd } = renderModal(WATER);

    expect(screen.getByRole("button", { name: "Decrease quantity" }).disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await userEvent.click(screen.getByRole("button", { name: "Increase quantity" }));

    expect(screen.getByRole("button", { name: "Add to ticket · €6.00" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));

    expect(onAdd).toHaveBeenCalledWith({
      productId: "p2",
      productName: "Water",
      size: null,
      unitPrice: 2,
      quantity: 2,
      cookingLevel: null,
      customizations: [],
      subtotal: 4,
    });
  });

  it("closes from the close button, Escape and the backdrop", async () => {
    const { onClose } = renderModal(WATER);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByTestId("item-config-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("ItemConfigModal reconfiguration", () => {
  afterEach(cleanup);

  const ITEM = {
    productId: "p1",
    productName: "Margherita",
    size: "Small",
    unitPrice: 5,
    quantity: 2,
    cookingLevel: "Rare",
    customizations: ["No basil"],
    subtotal: 10,
  };

  it("prefills the Item options and keeps the saved price for the same size", async () => {
    const { onAdd } = renderModal(PIZZA, { initialItem: ITEM });

    expect(screen.getByText("Edit item")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Margherita" })).toBeTruthy();
    expect(
      screen.getByText("Before: 2 x Margherita · Small · Rare · No basil · €10.00"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Small/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Rare" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("No basil")).toBeTruthy();
    expect(screen.getByLabelText("Quantity").textContent).toBe("2");
    expect(screen.getByText("Saved price kept: €5.00 each")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to sizes" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Medium" }));
    expect(screen.getByLabelText("Line total").textContent).toBe("€10.00");
    expect(screen.queryByLabelText("Before")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Update item" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "Small",
        unitPrice: 5,
        quantity: 2,
        cookingLevel: "Medium",
        customizations: ["No basil"],
        subtotal: 10,
      }),
    );
  });

  it("uses the current menu price when the size changes", async () => {
    const { onAdd } = renderModal(PIZZA, { initialItem: ITEM });

    // The Item's own size shows its saved price and "before", the others the menu price.
    expect(screen.getByRole("button", { name: /Small/ }).textContent).toContain("€5.00");
    expect(screen.getByRole("button", { name: /Small/ }).textContent).toContain("before");
    expect(screen.getByRole("button", { name: /Large/ }).textContent).toContain("€10.00");

    await userEvent.click(screen.getByRole("button", { name: /Large/ }));

    expect(screen.getByText("Size changed: new menu price €10.00 each")).toBeTruthy();
    expect(screen.getByLabelText("Line total").textContent).toBe("€20.00");
    expect(screen.getByLabelText("Before").textContent).toBe("€10.00");
    await userEvent.click(screen.getByRole("button", { name: "Update item" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ size: "Large", unitPrice: 10, subtotal: 20 }),
    );
  });

  it("asks for the size again when the Item's size is no longer offered", () => {
    renderModal(PIZZA, { initialItem: { ...ITEM, size: "Medium" } });

    expect(screen.getByRole("button", { name: /Large/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Choose a size")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update item" }).disabled).toBe(true);
  });

  it("allows only customizations and a lower quantity in restricted mode", async () => {
    const { onAdd } = renderModal(null, {
      initialItem: { ...ITEM, quantity: 3, subtotal: 15 },
      restricted: true,
      maxQuantity: 3,
    });

    expect(screen.getByRole("dialog", { name: "Configure Margherita" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Margherita" })).toBeTruthy();
    expect(screen.getByText(/no longer sellable/)).toBeTruthy();
    expect(screen.getByText("Small").parentElement.textContent).toContain("(locked)");
    expect(screen.getByText("Rare").parentElement.textContent).toContain("(locked)");
    expect(screen.getByText("Saved price kept: €5.00 each · max 3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to sizes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Medium" })).toBeNull();
    expect(screen.getByRole("button", { name: "Increase quantity" }).disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(screen.getByRole("button", { name: "Increase quantity" }).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Remove No basil" }));
    await userEvent.type(screen.getByLabelText("Customizations"), "Cut in 8{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Update item" }));

    expect(onAdd).toHaveBeenCalledWith({
      ...ITEM,
      customizations: ["Cut in 8"],
      quantity: 2,
      subtotal: 10,
    });
  });

  it("keeps the cooking level editable for an unavailable product", async () => {
    const { onAdd } = renderModal(
      { ...PIZZA, isAvailable: false },
      { initialItem: ITEM, restricted: true, maxQuantity: 2 },
    );

    expect(screen.getByText(/size and price are locked/)).toBeTruthy();
    expect(screen.getByText("Small").parentElement.textContent).toContain("(locked)");
    expect(screen.queryByRole("button", { name: "Large" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rare" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Increase quantity" }).disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Well done" }));
    await userEvent.click(screen.getByRole("button", { name: "Update item" }));

    expect(onAdd).toHaveBeenCalledWith({ ...ITEM, cookingLevel: "Well done" });
  });

  it("closes from Cancel without updating the Item", async () => {
    const { onAdd, onClose } = renderModal(PIZZA, { initialItem: ITEM });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("falls back to the default cooking level when the Item's one is gone", () => {
    renderModal(PIZZA, { initialItem: { ...ITEM, cookingLevel: "Burnt" } });

    expect(screen.getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});

describe("ItemConfigModal field limits", () => {
  afterEach(cleanup);

  it("limits the customization input to LIST_ITEM", () => {
    renderModal(WATER);

    expect(screen.getByLabelText("Customizations").getAttribute("maxlength")).toBe(
      String(FIELD_LIMITS.LIST_ITEM),
    );
  });

  it("disables the customization Add button at LIST_SIZE and ignores more input", async () => {
    const { onAdd } = renderModal(WATER);
    const field = screen.getByLabelText("Customizations");

    for (let index = 0; index < FIELD_LIMITS.LIST_SIZE; index += 1)
      await userEvent.type(field, `Note ${index}{Enter}`);

    expect(screen.getByRole("button", { name: "Add" }).disabled).toBe(true);
    expect(
      screen.getByText(`Maximum ${FIELD_LIMITS.LIST_SIZE} customizations reached.`),
    ).toBeTruthy();

    await userEvent.type(field, "Extra{Enter}");
    await userEvent.click(screen.getByRole("button", { name: /Add to ticket/ }));

    expect(onAdd.mock.calls[0][0].customizations).toHaveLength(FIELD_LIMITS.LIST_SIZE);
    expect(onAdd.mock.calls[0][0].customizations).not.toContain("Extra");
  }, 20000);
});

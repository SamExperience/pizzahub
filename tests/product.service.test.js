import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { register } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { createMenu } from "../src/services/menu.service";
import { createCategory } from "../src/services/category.service";
import {
  createProduct,
  getProductById,
  getProductsByCategoryId,
  updateProductById,
  validateProductPricing,
} from "../src/services/product.service";

const TEST_PASSWORD = "Password123!";

let category;

beforeAll(async () => {
  const userCredential = await register(
    `test-product-${Date.now()}@example.com`,
    TEST_PASSWORD,
  );
  const user = userCredential.user;
  const result = await createOnboardingWorkspace({
    uid: user.uid,
    userName: user.displayName,
    companyName: "Product Test Company",
    storeName: "Product Test Store",
    street: "Rue du Lyon",
    streetNumber: "9",
    postalCode: "1201",
    city: "Genève",
    country: "Switzerland",
  });
  const menu = await createMenu(result.storeId, "Menu principale");
  category = await createCategory(menu.id, "Pizzas", 1);
});

describe("validateProductPricing", () => {
  it("accepts sizes with a null price", () => {
    const result = validateProductPricing({
      sizes: [{ name: " Large ", price: 12 }],
      price: null,
    });
    expect(result).toEqual({
      sizes: [{ name: "Large", price: 12 }],
      price: null,
    });
  });

  it("treats empty sizes as no sizes and uses the price", () => {
    expect(validateProductPricing({ sizes: [], price: 8 })).toEqual({
      sizes: null,
      price: 8,
    });
  });

  it("rejects sizes together with a price", () => {
    expect(() =>
      validateProductPricing({ sizes: [{ name: "S", price: 5 }], price: 5 }),
    ).toThrow("Product price must be null when sizes are defined");
  });

  it("rejects no sizes and no price", () => {
    expect(() => validateProductPricing({ sizes: null, price: null })).toThrow(
      "Product price is required when there are no sizes",
    );
  });

  it("rejects invalid size entries", () => {
    expect(() =>
      validateProductPricing({ sizes: [{ name: "", price: 5 }] }),
    ).toThrow("Product size name is required");
    expect(() =>
      validateProductPricing({ sizes: [{ name: "S", price: -1 }] }),
    ).toThrow("Product size price must be a non-negative number");
  });
});

describe("createProduct", () => {
  it("creates a product with sizes and a null price", async () => {
    const product = await createProduct(category.id, {
      name: "Margherita",
      position: 1,
      sizes: [
        { name: "Medium", price: 10 },
        { name: "Large", price: 14 },
      ],
    });
    expect(product.id).toBeDefined();
    expect(product.categoryId).toBe(category.id);
    expect(product.sizes).toHaveLength(2);
    expect(product.price).toBeNull();
  });

  it("creates a product without sizes using its price", async () => {
    const product = await createProduct(category.id, {
      name: "Tiramisu",
      position: 2,
      price: 6.5,
    });
    expect(product.sizes).toBeNull();
    expect(product.price).toBe(6.5);
  });

  it("applies defaults and trims the name", async () => {
    const product = await createProduct(category.id, {
      name: " Cola ",
      position: 3,
      sizes: [],
      price: 3,
    });
    expect(product.name).toBe("Cola");
    expect(product.isAvailable).toBe(true);
    expect(product.sizes).toBeNull();
    expect(product.description).toBeNull();
    expect(product.ingredients).toBeNull();
    expect(product.imageUrl).toBeNull();
  });

  it("rejects sizes together with a price", async () => {
    await expect(
      createProduct(category.id, {
        name: "Invalid",
        position: 4,
        sizes: [{ name: "S", price: 5 }],
        price: 5,
      }),
    ).rejects.toThrow("Product price must be null when sizes are defined");
  });

  it("rejects a product with neither sizes nor price", async () => {
    await expect(
      createProduct(category.id, { name: "Invalid", position: 4 }),
    ).rejects.toThrow("Product price is required when there are no sizes");
  });

  it("rejects a missing or unknown category", async () => {
    await expect(
      createProduct("", { name: "X", position: 1, price: 1 }),
    ).rejects.toThrow("Category ID is required");
    // Firestore rules deny reading a missing category before the service
    // can report "Category not found", so only the rejection is asserted.
    await expect(
      createProduct("unknown-category", { name: "X", position: 1, price: 1 }),
    ).rejects.toThrow();
  });

  it("rejects an empty name and an invalid position", async () => {
    await expect(
      createProduct(category.id, { name: "  ", position: 5, price: 1 }),
    ).rejects.toThrow("Product name is required");
    await expect(
      createProduct(category.id, { name: "X", position: 0, price: 1 }),
    ).rejects.toThrow("Product position must be a positive integer");
  });
});

describe("product reading", () => {
  let readCategory;

  beforeAll(async () => {
    readCategory = await createCategory(category.menuId, "Desserts", 2);
    await createProduct(readCategory.id, { name: "B", position: 2, price: 2 });
    await createProduct(readCategory.id, { name: "A", position: 1, price: 1 });
  });

  it("lists products of a category ordered by position", async () => {
    const products = await getProductsByCategoryId(readCategory.id);
    expect(products.map((p) => p.name)).toEqual(["A", "B"]);
    expect(products.every((p) => p.categoryId === readCategory.id)).toBe(true);
  });

  it("returns an empty list for a category without products", async () => {
    const empty = await createCategory(category.menuId, "Empty", 3);
    expect(await getProductsByCategoryId(empty.id)).toEqual([]);
  });

  it("gets a product by id", async () => {
    const [first] = await getProductsByCategoryId(readCategory.id);
    const product = await getProductById(first.id);
    expect(product).toMatchObject({ id: first.id, name: "A", price: 1 });
  });

  it("rejects missing ids and unknown products", async () => {
    await expect(getProductsByCategoryId("")).rejects.toThrow(
      "Category ID is required",
    );
    await expect(getProductById("")).rejects.toThrow("Product ID is required");
    await expect(getProductById("unknown-product")).rejects.toThrow();
  });
});

describe("updateProductById", () => {
  let updateCategory;
  let product;

  beforeAll(async () => {
    updateCategory = await createCategory(category.menuId, "Updates", 4);
  });

  beforeEach(async () => {
    product = await createProduct(updateCategory.id, {
      name: "Original",
      position: 1,
      description: "Desc",
      price: 5,
    });
  });

  it("updates name and description and refreshes updatedAt", async () => {
    await updateProductById(product.id, {
      name: " Renamed ",
      description: "New",
    });
    const updated = await getProductById(product.id);
    expect(updated.name).toBe("Renamed");
    expect(updated.description).toBe("New");
    expect(updated.price).toBe(5);
    expect(updated.categoryId).toBe(updateCategory.id);
    expect(updated.updatedAt.toMillis()).toBeGreaterThanOrEqual(
      updated.createdAt.toMillis(),
    );
  });

  it("updates position and availability", async () => {
    await updateProductById(product.id, { position: 3, isAvailable: false });
    const updated = await getProductById(product.id);
    expect(updated.position).toBe(3);
    expect(updated.isAvailable).toBe(false);
    expect(updated.name).toBe("Original");
  });

  it("switches between price and sizes", async () => {
    await updateProductById(product.id, {
      sizes: [{ name: " Large ", price: 9 }],
      price: null,
    });
    let updated = await getProductById(product.id);
    expect(updated.sizes).toEqual([{ name: "Large", price: 9 }]);
    expect(updated.price).toBeNull();

    await updateProductById(product.id, { sizes: null, price: 7 });
    updated = await getProductById(product.id);
    expect(updated.sizes).toBeNull();
    expect(updated.price).toBe(7);
  });

  it("rejects invalid pricing combinations", async () => {
    await expect(
      updateProductById(product.id, { sizes: [{ name: "S", price: 1 }] }),
    ).rejects.toThrow("Product price must be null when sizes are defined");
    await expect(
      updateProductById(product.id, { price: null }),
    ).rejects.toThrow("Product price is required when there are no sizes");
  });

  it("does not change the category", async () => {
    await updateProductById(product.id, {
      categoryId: "other-category",
      name: "Same category",
    });
    const updated = await getProductById(product.id);
    expect(updated.categoryId).toBe(updateCategory.id);
  });

  it("rejects invalid input", async () => {
    await expect(updateProductById("", { name: "X" })).rejects.toThrow(
      "Product ID is required",
    );
    await expect(updateProductById(product.id, null)).rejects.toThrow(
      "Product data is required",
    );
    await expect(updateProductById(product.id, {})).rejects.toThrow(
      "Nothing to update",
    );
    await expect(
      updateProductById(product.id, { name: "  " }),
    ).rejects.toThrow("Product name is required");
    await expect(
      updateProductById(product.id, { position: 0 }),
    ).rejects.toThrow("Product position must be a positive integer");
    await expect(
      updateProductById(product.id, { isAvailable: "yes" }),
    ).rejects.toThrow("Product availability must be a boolean");
    await expect(
      updateProductById("unknown-product", { name: "X" }),
    ).rejects.toThrow();
  });
});

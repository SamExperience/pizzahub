// @vitest-environment node
// Storage emulator uploads fail under jsdom XHR; the node environment uses fetch.
import { deleteObject, getDownloadURL, ref, uploadString } from "firebase/storage";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { storage } from "../src/services/firebase";
import { register } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { createMenu } from "../src/services/menu.service";
import { createCategory } from "../src/services/category.service";
import {
  createProduct,
  deleteProductById,
  getProductById,
  getProductsByCategoryId,
  setProductAvailability,
  updateProductById,
  validateProductCookingLevels,
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

describe("product validation", () => {
  let validationCategory;

  beforeAll(async () => {
    validationCategory = await createCategory(category.menuId, "Validation", 7);
  });

  it("rejects a position already used in the same category", async () => {
    await createProduct(validationCategory.id, {
      name: "First",
      position: 1,
      price: 1,
    });
    await expect(
      createProduct(validationCategory.id, {
        name: "Second",
        position: 1,
        price: 1,
      }),
    ).rejects.toThrow("Product position is already in use");
  });

  it("allows the same position in another category", async () => {
    const other = await createCategory(category.menuId, "Other", 8);
    const product = await createProduct(other.id, {
      name: "Same position",
      position: 1,
      price: 1,
    });
    expect(product.position).toBe(1);
  });

  it("stores cooking levels and a default level", async () => {
    const product = await createProduct(validationCategory.id, {
      name: "Steak",
      position: 2,
      price: 18,
      availableCookingLevels: [" rare ", "medium"],
      defaultCookingLevel: "medium",
    });
    expect(product.availableCookingLevels).toEqual(["rare", "medium"]);
    expect(product.defaultCookingLevel).toBe("medium");
  });

  it("rejects invalid cooking levels", async () => {
    const invalid = (extra) =>
      createProduct(validationCategory.id, {
        name: "Invalid",
        position: 9,
        price: 1,
        ...extra,
      });

    await expect(invalid({ availableCookingLevels: "rare" })).rejects.toThrow(
      "Product cooking levels must be an array",
    );
    await expect(invalid({ availableCookingLevels: ["rare", " "] })).rejects.toThrow(
      "Product cooking levels must not contain blank values",
    );
    await expect(
      invalid({ availableCookingLevels: ["rare", "rare"] }),
    ).rejects.toThrow("Product cooking levels must not contain duplicates");
    await expect(invalid({ defaultCookingLevel: "rare" })).rejects.toThrow(
      "Product default cooking level must be one of the available cooking levels",
    );
    await expect(
      invalid({ availableCookingLevels: ["rare"], defaultCookingLevel: "well" }),
    ).rejects.toThrow(
      "Product default cooking level must be one of the available cooking levels",
    );
  });

  it("rejects invalid optional fields and availability", async () => {
    const invalid = (extra) =>
      createProduct(validationCategory.id, {
        name: "Invalid",
        position: 9,
        price: 1,
        ...extra,
      });

    await expect(invalid({ description: 5 })).rejects.toThrow(
      "Product description must be text",
    );
    await expect(invalid({ imageUrl: 5 })).rejects.toThrow(
      "Product image URL must be text",
    );
    await expect(invalid({ ingredients: ["tomato", ""] })).rejects.toThrow(
      "Product ingredients must not contain blank values",
    );
    await expect(invalid({ isAvailable: "yes" })).rejects.toThrow(
      "Product availability must be a boolean",
    );
  });
});

describe("validateProductCookingLevels", () => {
  it("normalizes levels and treats empty levels as none", () => {
    expect(
      validateProductCookingLevels({
        availableCookingLevels: [" rare "],
        defaultCookingLevel: " rare ",
      }),
    ).toEqual({ availableCookingLevels: ["rare"], defaultCookingLevel: "rare" });
    expect(validateProductCookingLevels({ availableCookingLevels: [] })).toEqual({
      availableCookingLevels: null,
      defaultCookingLevel: null,
    });
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
  let nextPosition = 1;

  beforeAll(async () => {
    updateCategory = await createCategory(category.menuId, "Updates", 4);
  });

  beforeEach(async () => {
    product = await createProduct(updateCategory.id, {
      name: "Original",
      position: nextPosition++,
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
    await updateProductById(product.id, { position: 100, isAvailable: false });
    const updated = await getProductById(product.id);
    expect(updated.position).toBe(100);
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

  it("rejects a position used by another product but keeps its own", async () => {
    const other = await createProduct(updateCategory.id, {
      name: "Other",
      position: nextPosition++,
      price: 1,
    });
    await expect(
      updateProductById(product.id, { position: other.position }),
    ).rejects.toThrow("Product position is already in use");
    await updateProductById(product.id, { position: product.position });
  });

  it("validates cooking levels on the merged result", async () => {
    await updateProductById(product.id, {
      availableCookingLevels: ["rare", "medium"],
      defaultCookingLevel: "rare",
    });
    await expect(
      updateProductById(product.id, { defaultCookingLevel: "well" }),
    ).rejects.toThrow(
      "Product default cooking level must be one of the available cooking levels",
    );
    await expect(
      updateProductById(product.id, { availableCookingLevels: ["medium"] }),
    ).rejects.toThrow(
      "Product default cooking level must be one of the available cooking levels",
    );
    await updateProductById(product.id, {
      availableCookingLevels: null,
      defaultCookingLevel: null,
    });
    const updated = await getProductById(product.id);
    expect(updated.availableCookingLevels).toBeNull();
    expect(updated.defaultCookingLevel).toBeNull();
  });

  it("rejects invalid optional field types", async () => {
    await expect(
      updateProductById(product.id, { description: 5 }),
    ).rejects.toThrow("Product description must be text");
    await expect(
      updateProductById(product.id, { ingredients: "tomato" }),
    ).rejects.toThrow("Product ingredients must be an array");
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

describe("setProductAvailability", () => {
  let availabilityCategory;

  beforeAll(async () => {
    availabilityCategory = await createCategory(
      category.menuId,
      "Availability",
      10,
    );
  });

  const makeProduct = (position) =>
    createProduct(availabilityCategory.id, {
      name: `Product ${position}`,
      position,
      price: 5,
    });

  it("toggles availability and persists it", async () => {
    const product = await makeProduct(1);

    await setProductAvailability(product.id, false);
    expect((await getProductById(product.id)).isAvailable).toBe(false);

    await setProductAvailability(product.id, true);
    expect((await getProductById(product.id)).isAvailable).toBe(true);
  });

  it("keeps an unavailable product in the menu with its data unchanged", async () => {
    const cat = await createCategory(category.menuId, "Kept", 11);
    const first = await createProduct(cat.id, {
      name: "First",
      position: 1,
      price: 4,
    });
    const second = await createProduct(cat.id, {
      name: "Second",
      position: 2,
      price: 6,
    });

    await setProductAvailability(first.id, false);

    const products = await getProductsByCategoryId(cat.id);
    expect(products.map((p) => [p.id, p.position, p.isAvailable])).toEqual([
      [first.id, 1, false],
      [second.id, 2, true],
    ]);
    const stored = await getProductById(first.id);
    expect(stored.name).toBe("First");
    expect(stored.price).toBe(4);
  });

  it("keeps availability when a sibling is deleted", async () => {
    const cat = await createCategory(category.menuId, "Sibling", 12);
    const first = await createProduct(cat.id, {
      name: "First",
      position: 1,
      price: 4,
    });
    const second = await createProduct(cat.id, {
      name: "Second",
      position: 2,
      price: 6,
    });
    await setProductAvailability(second.id, false);

    await deleteProductById(first.id);

    const remaining = await getProductsByCategoryId(cat.id);
    expect(remaining.map((p) => [p.id, p.position, p.isAvailable])).toEqual([
      [second.id, 1, false],
    ]);
  });

  it("rejects invalid input", async () => {
    const product = await makeProduct(2);

    await expect(setProductAvailability("", true)).rejects.toThrow(
      "Product ID is required",
    );
    await expect(setProductAvailability(product.id, "yes")).rejects.toThrow(
      "Product availability must be a boolean",
    );
    await expect(setProductAvailability(product.id)).rejects.toThrow(
      "Product availability must be a boolean",
    );
    await expect(
      setProductAvailability("unknown-product", false),
    ).rejects.toThrow();
  });
});

describe("deleteProductById", () => {
  let deleteCategory;

  beforeAll(async () => {
    deleteCategory = await createCategory(category.menuId, "Deletes", 5);
  });

  const makeProduct = (categoryId, position, extra = {}) =>
    createProduct(categoryId, {
      name: `Product ${position}`,
      position,
      price: 5,
      ...extra,
    });

  it("deletes the product and renumbers the remaining ones", async () => {
    const cat = await createCategory(category.menuId, "Renumber", 6);
    const [first, second, third] = [
      await makeProduct(cat.id, 1),
      await makeProduct(cat.id, 2),
      await makeProduct(cat.id, 3),
    ];

    await deleteProductById(second.id);

    // Rules deny reading a missing document, so only rejection is asserted.
    await expect(getProductById(second.id)).rejects.toThrow();
    const remaining = await getProductsByCategoryId(cat.id);
    expect(remaining.map((p) => [p.id, p.position])).toEqual([
      [first.id, 1],
      [third.id, 2],
    ]);
  });

  it("deletes the product image from Storage", async () => {
    const imageRef = ref(storage, `products/test-${Date.now()}.txt`);
    await uploadString(imageRef, "image");
    const imageUrl = await getDownloadURL(imageRef);
    const product = await makeProduct(deleteCategory.id, 1, { imageUrl });

    await deleteProductById(product.id);

    await expect(getDownloadURL(imageRef)).rejects.toThrow();
  });

  it("still deletes the product when the image is already gone", async () => {
    const imageRef = ref(storage, `products/missing-${Date.now()}.txt`);
    await uploadString(imageRef, "image");
    const imageUrl = await getDownloadURL(imageRef);
    const product = await makeProduct(deleteCategory.id, 1, { imageUrl });
    await deleteObject(imageRef);

    await deleteProductById(product.id);

    await expect(getProductById(product.id)).rejects.toThrow();
  });

  it("rejects invalid input", async () => {
    await expect(deleteProductById("")).rejects.toThrow(
      "Product ID is required",
    );
    await expect(deleteProductById("unknown-product")).rejects.toThrow();
  });
});

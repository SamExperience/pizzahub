import { describe, expect, it } from "vitest";
import { register } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { createMenu } from "../src/services/menu.service";
import {
  createCategory,
  getCategoriesByMenuId,
  deleteCategoryById,
  updateCategoryById,
} from "../src/services/category.service";

const TEST_PASSWORD = "Password123!";

const registerTestUser = async () => {
  const email = `test-category-${Date.now()}@example.com`;
  const userCredential = await register(email, TEST_PASSWORD);

  return userCredential.user;
};

describe("createCategory", () => {
  it("creates a category for a menu", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Create Category Test Company",
      storeName: "Create Category Test Store",
      street: "Rue du Lyon",
      streetNumber: "5",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    const category = await createCategory(menu.id, "Pizzas", 1);
    expect(category.id).toBeDefined();
    expect(category.menuId).toBe(menu.id);
    expect(category.name).toBe("Pizzas");
    expect(category.position).toBe(1);
  });
  it("trims whitespace from the category name", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Normalize Category Test Company",
      storeName: "Normalize Category Test Store",
      street: "Rue du Lyon",
      streetNumber: "6",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    const category = await createCategory(menu.id, " Pizzas ", 1);
    expect(category.name).toBe("Pizzas");
  });
  it("rejects a duplicate category name in the same menu", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Duplicate Name Test Company",
      storeName: "Duplicate Name Test Store",
      street: "Rue du Lyon",
      streetNumber: "7",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    await createCategory(menu.id, "Pizzas", 1);
    await expect(createCategory(menu.id, "Pizzas", 2)).rejects.toThrow(
      "Category name already exists",
    );
  });
  it("rejects a duplicate category position in the same menu", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Duplicate Position Test Company",
      storeName: "Duplicate Position Test Store",
      street: "Rue du Lyon",
      streetNumber: "8",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    await createCategory(menu.id, "Pizzas", 1);
    await expect(createCategory(menu.id, "Desserts", 1)).rejects.toThrow(
      "Category position is already in use",
    );
  });
  it("rejects an invalid menu id", async () => {
    await expect(createCategory("", "Pizzas", 1)).rejects.toThrow(
      "Menu ID is required",
    );
  });
  it("rejects an invalid category name", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Invalid Name Test Company",
      storeName: "Invalid Name Test Store",
      street: "Rue du Lyon",
      streetNumber: "9",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    await expect(createCategory(menu.id, " ", 1)).rejects.toThrow(
      "Category name is required",
    );
  });
  it("rejects an invalid category position", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Invalid Position Test Company",
      storeName: "Invalid Position Test Store",
      street: "Rue du Lyon",
      streetNumber: "10",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    await expect(createCategory(menu.id, "Pizzas", 0)).rejects.toThrow(
      "Category position must be a positive integer",
    );
  });
});

describe("getCategoriesByMenuId", () => {
  it("returns categories ordered by position", async () => {
    const user = await registerTestUser();

    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Get Categories Test Company",
      storeName: "Get Categories Test Store",
      street: "Rue du Lyon",
      streetNumber: "6",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });

    const menu = await createMenu(result.storeId, "Menu principale");

    await createCategory(menu.id, "Desserts", 3);
    await createCategory(menu.id, "Pizzas", 1);
    await createCategory(menu.id, "Boissons", 2);

    const categories = await getCategoriesByMenuId(menu.id);

    expect(categories).toHaveLength(3);
    expect(categories[0].name).toBe("Pizzas");
    expect(categories[1].name).toBe("Boissons");
    expect(categories[2].name).toBe("Desserts");
  });
});

describe("deleteCategoryById", () => {
  it("deletes a category by id", async () => {
    const user = await registerTestUser();

    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Delete Category Test Company",
      storeName: "Delete Category Test Store",
      street: "Rue du Lyon",
      streetNumber: "7",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });

    const menu = await createMenu(result.storeId, "Menu principale");

    const category = await createCategory(menu.id, "Pizzas", 1);

    await deleteCategoryById(category.id);

    const categories = await getCategoriesByMenuId(menu.id);

    expect(categories).toHaveLength(0);
  });
});

describe("updateCategoryById", () => {
  it("updates both name and position", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Update Category Test Company",
      storeName: "Update Category Test Store",
      street: "Rue du Lyon",
      streetNumber: "7",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    const category = await createCategory(menu.id, "Pizzas", 1);
    await updateCategoryById(category.id, {
      name: "New Category",
      position: 2,
    });
    const categories = await getCategoriesByMenuId(menu.id);
    expect(categories).toHaveLength(1);
    expect(categories[0].name).toBe("New Category");
    expect(categories[0].position).toBe(2);
  });
  it("updates only the category name", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Update Name Test Company",
      storeName: "Update Name Test Store",
      street: "Rue du Lyon",
      streetNumber: "8",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    const category = await createCategory(menu.id, "Pizzas", 1);
    await updateCategoryById(category.id, { name: "New Pizzas" });
    const categories = await getCategoriesByMenuId(menu.id);
    expect(categories[0].name).toBe("New Pizzas");
    expect(categories[0].position).toBe(1);
  });
  it("updates only the category position", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Update Position Test Company",
      storeName: "Update Position Test Store",
      street: "Rue du Lyon",
      streetNumber: "9",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    const category = await createCategory(menu.id, "Pizzas", 1);
    await updateCategoryById(category.id, { position: 2 });
    const categories = await getCategoriesByMenuId(menu.id);
    expect(categories[0].name).toBe("Pizzas");
    expect(categories[0].position).toBe(2);
  });
  it("rejects an update with no fields", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Empty Update Test Company",
      storeName: "Empty Update Test Store",
      street: "Rue du Lyon",
      streetNumber: "10",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    const category = await createCategory(menu.id, "Pizzas", 1);
    await expect(updateCategoryById(category.id, {})).rejects.toThrow(
      "Nothing to update",
    );
  });
  it("rejects a duplicate category name", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Duplicate Update Name Test Company",
      storeName: "Duplicate Update Name Test Store",
      street: "Rue du Lyon",
      streetNumber: "11",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    await createCategory(menu.id, "Pizzas", 1);
    const category = await createCategory(menu.id, "Desserts", 2);
    await expect(
      updateCategoryById(category.id, { name: "Pizzas" }),
    ).rejects.toThrow("Category name already exists");
  });
  it("rejects a duplicate category position", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Duplicate Update Position Test Company",
      storeName: "Duplicate Update Position Test Store",
      street: "Rue du Lyon",
      streetNumber: "12",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    await createCategory(menu.id, "Pizzas", 1);
    const category = await createCategory(menu.id, "Desserts", 2);
    await expect(
      updateCategoryById(category.id, { position: 1 }),
    ).rejects.toThrow("Category position is already in use");
  });
  it("normalizes whitespace in the category name", async () => {
    const user = await registerTestUser();
    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Normalize Update Name Test Company",
      storeName: "Normalize Update Name Test Store",
      street: "Rue du Lyon",
      streetNumber: "13",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });
    const menu = await createMenu(result.storeId, "Menu principale");
    const category = await createCategory(menu.id, "Pizzas", 1);
    await updateCategoryById(category.id, { name: " New Pizzas " });
    const categories = await getCategoriesByMenuId(menu.id);
    expect(categories[0].name).toBe("New Pizzas");
  });
});

import { describe, expect, it } from "vitest";
import { register } from "../src/services/auth.service";
import { createCategory } from "../src/services/category.service";
import { createProduct } from "../src/services/product.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import {
  createMenu,
  getMenuByStoreId,
  isMenuReady,
} from "../src/services/menu.service";
const TEST_PASSWORD = "Password123!";

const registerTestUser = async () => {
  const email = `test-menu-${Date.now()}@example.com`;
  const userCredential = await register(email, TEST_PASSWORD);

  return userCredential.user;
};

describe("getMenuByStoreId", () => {
  it("returns null when the store has no configured menu", async () => {
    const user = await registerTestUser();

    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Menu Test Company",
      storeName: "Menu Test Store",
      street: "Rue du Lyon",
      streetNumber: "3",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });

    const menu = await getMenuByStoreId(result.storeId);

    expect(menu).toBeNull();
  });
});

describe("createMenu", () => {
  it("creates a menu for a store", async () => {
    const user = await registerTestUser();

    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Create Menu Test Company",
      storeName: "Create Menu Test Store",
      street: "Rue du Lyon",
      streetNumber: "4",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });

    const menu = await createMenu(result.storeId, "Menu principale");

    expect(menu.id).toBeDefined();
    expect(menu.storeId).toBe(result.storeId);
    expect(menu.name).toBe("Menu principale");
  });
});

describe("isMenuReady", () => {
  const createStore = async () => {
    const user = await registerTestUser();

    const result = await createOnboardingWorkspace({
      uid: user.uid,
      userName: user.displayName,
      companyName: "Ready Test Company",
      storeName: "Ready Test Store",
      street: "Rue du Lyon",
      streetNumber: "3",
      postalCode: "1201",
      city: "Genève",
      country: "Switzerland",
    });

    return result.storeId;
  };

  it("is false when the store has no menu", async () => {
    expect(await isMenuReady(await createStore())).toBe(false);
  });

  it("is false when the menu has no categories", async () => {
    const storeId = await createStore();
    await createMenu(storeId, "Menu");

    expect(await isMenuReady(storeId)).toBe(false);
  });

  it("is false when no category has products", async () => {
    const storeId = await createStore();
    const menu = await createMenu(storeId, "Menu");
    await createCategory(menu.id, "Pizze", 1);

    expect(await isMenuReady(storeId)).toBe(false);
  });

  it("is true when a category has a product, even an unavailable one", async () => {
    const storeId = await createStore();
    const menu = await createMenu(storeId, "Menu");
    await createCategory(menu.id, "Pizze", 1);
    const drinks = await createCategory(menu.id, "Bevande", 2);
    await createProduct(drinks.id, {
      name: "Cola",
      position: 1,
      price: 3,
      isAvailable: false,
    });

    expect(await isMenuReady(storeId)).toBe(true);
  });
});

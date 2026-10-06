import { describe, expect, it } from "vitest";
import { register } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { createMenu } from "../src/services/menu.service";
import {
  createCategory,
  getCategoriesByMenuId,
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

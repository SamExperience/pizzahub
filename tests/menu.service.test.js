import { describe, expect, it } from "vitest";
import { register } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { createMenu, getMenuByStoreId } from "../src/services/menu.service";
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

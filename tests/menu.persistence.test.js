// @vitest-environment node
// End-to-end persistence check: every assertion re-reads the data straight
// from Firestore instead of trusting the value returned by the services.
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/services/firebase";
import { register } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { createMenu, getMenuByStoreId } from "../src/services/menu.service";
import {
  createCategory,
  deleteCategoryById,
  getCategoriesByMenuId,
  updateCategoryById,
} from "../src/services/category.service";
import {
  createProduct,
  deleteProductById,
  getProductById,
  getProductsByCategoryId,
  setProductAvailability,
  updateProductById,
} from "../src/services/product.service";

const TEST_PASSWORD = "Password123!";

const createStoreWithMenu = async (label) => {
  const userCredential = await register(
    `test-persistence-${label}-${Date.now()}@example.com`,
    TEST_PASSWORD,
  );
  const user = userCredential.user;
  const result = await createOnboardingWorkspace({
    uid: user.uid,
    userName: user.displayName,
    companyName: `Persistence ${label} Company`,
    storeName: `Persistence ${label} Store`,
    street: "Rue du Lyon",
    streetNumber: "11",
    postalCode: "1201",
    city: "Genève",
    country: "Switzerland",
  });
  const menu = await createMenu(result.storeId, `Menu ${label}`);

  return { storeId: result.storeId, menu };
};

const readRaw = async (collectionName, id) => {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? snap.data() : null;
};

const countByField = async (collectionName, field, value) => {
  const snap = await getDocs(
    query(collection(db, collectionName), where(field, "==", value)),
  );
  return snap.size;
};

let store;
let otherStore;
let pizzas;
let drinks;
let sizedProduct;
let plainProduct;

beforeAll(async () => {
  // The last registered user stays signed in, so the other store is created
  // first and the main store last.
  otherStore = await createStoreWithMenu("other");
  await createCategory(otherStore.menu.id, "Other category", 1);
  store = await createStoreWithMenu("main");
});

describe("create", () => {
  it("persists the menu with all model fields", async () => {
    const stored = await readRaw("menus", store.menu.id);

    expect(stored.storeId).toBe(store.storeId);
    expect(stored.name).toBe("Menu main");
    expect(stored.createdAt).toBeDefined();
    expect(stored.updatedAt).toBeDefined();
  });

  it("persists categories linked to the menu", async () => {
    pizzas = await createCategory(store.menu.id, "Pizzas", 1);
    drinks = await createCategory(store.menu.id, "Drinks", 2);

    const stored = await readRaw("categories", pizzas.id);

    expect(stored.menuId).toBe(store.menu.id);
    expect(stored.name).toBe("Pizzas");
    expect(stored.position).toBe(1);
    expect(stored.createdAt).toBeDefined();
    expect(stored.updatedAt).toBeDefined();
  });

  it("persists a product with sizes and a null price", async () => {
    sizedProduct = await createProduct(pizzas.id, {
      name: "Margherita",
      description: "Classic",
      ingredients: ["tomato", "mozzarella"],
      sizes: [
        { name: "Medium", price: 12 },
        { name: "Large", price: 15 },
      ],
      availableCookingLevels: ["well done", "normal"],
      defaultCookingLevel: "normal",
      position: 1,
    });

    const stored = await readRaw("products", sizedProduct.id);

    expect(stored).toMatchObject({
      categoryId: pizzas.id,
      name: "Margherita",
      description: "Classic",
      ingredients: ["tomato", "mozzarella"],
      sizes: [
        { name: "Medium", price: 12 },
        { name: "Large", price: 15 },
      ],
      price: null,
      availableCookingLevels: ["well done", "normal"],
      defaultCookingLevel: "normal",
      isAvailable: true,
      imageUrl: null,
      position: 1,
    });
    expect(stored.createdAt).toBeDefined();
    expect(stored.updatedAt).toBeDefined();
  });

  it("persists a product without sizes using a single price", async () => {
    plainProduct = await createProduct(drinks.id, {
      name: "Cola",
      price: 3.5,
      position: 1,
    });

    const stored = await readRaw("products", plainProduct.id);

    expect(stored).toMatchObject({
      categoryId: drinks.id,
      name: "Cola",
      description: null,
      ingredients: null,
      sizes: null,
      price: 3.5,
      availableCookingLevels: null,
      defaultCookingLevel: null,
      isAvailable: true,
      imageUrl: null,
      position: 1,
    });
  });
});

describe("read", () => {
  it("returns the persisted menu including its id", async () => {
    const menu = await getMenuByStoreId(store.storeId);

    expect(menu.id).toBe(store.menu.id);
    expect(menu.storeId).toBe(store.storeId);
    expect(menu.name).toBe("Menu main");
  });

  it("returns categories ordered by position", async () => {
    const categories = await getCategoriesByMenuId(store.menu.id);

    expect(categories.map((category) => category.name)).toEqual([
      "Pizzas",
      "Drinks",
    ]);
  });

  it("returns products by category and by id", async () => {
    const products = await getProductsByCategoryId(pizzas.id);
    const product = await getProductById(sizedProduct.id);

    expect(products.map((item) => item.id)).toEqual([sizedProduct.id]);
    expect(product.name).toBe("Margherita");
  });
});

describe("update", () => {
  it("persists category changes", async () => {
    const before = await readRaw("categories", drinks.id);

    await updateCategoryById(drinks.id, { name: "Beverages" });

    const after = await readRaw("categories", drinks.id);
    expect(after.name).toBe("Beverages");
    expect(after.position).toBe(2);
    expect(after.menuId).toBe(store.menu.id);
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.updatedAt.toMillis()).toBeGreaterThanOrEqual(
      before.updatedAt.toMillis(),
    );
  });

  it("persists product changes and leaves other fields untouched", async () => {
    const before = await readRaw("products", sizedProduct.id);

    await updateProductById(sizedProduct.id, {
      name: "Margherita DOP",
      ingredients: ["tomato", "buffalo mozzarella"],
    });

    const after = await readRaw("products", sizedProduct.id);
    expect(after.name).toBe("Margherita DOP");
    expect(after.ingredients).toEqual(["tomato", "buffalo mozzarella"]);
    expect(after.sizes).toEqual(before.sizes);
    expect(after.price).toBeNull();
    expect(after.position).toBe(before.position);
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.updatedAt.toMillis()).toBeGreaterThanOrEqual(
      before.updatedAt.toMillis(),
    );
  });

  it("persists availability as a flag without removing the product", async () => {
    await setProductAvailability(plainProduct.id, false);

    const stored = await readRaw("products", plainProduct.id);
    expect(stored.isAvailable).toBe(false);
    expect(stored.name).toBe("Cola");
  });
});

describe("delete", () => {
  it("deletes a product and renumbers its siblings", async () => {
    const second = await createProduct(pizzas.id, {
      name: "Diavola",
      price: 14,
      position: 2,
    });
    const third = await createProduct(pizzas.id, {
      name: "Funghi",
      price: 13,
      position: 3,
    });

    await deleteProductById(sizedProduct.id);

    // Rules read the parent on get, so a deleted doc is checked via a query.
    const remaining = await getProductsByCategoryId(pizzas.id);
    expect(remaining.map((item) => [item.id, item.position])).toEqual([
      [second.id, 1],
      [third.id, 2],
    ]);
  });

  it("deletes a category with all its products and renumbers the rest", async () => {
    await deleteCategoryById(pizzas.id);

    const categories = await getCategoriesByMenuId(store.menu.id);
    expect(categories.map((category) => [category.id, category.position])).toEqual(
      [[drinks.id, 1]],
    );

    // Products of the deleted category are gone (orphans are unreadable by
    // rule, so a query is either empty or denied); the unavailable product of
    // the other category is untouched.
    const orphans = await countByField("products", "categoryId", pizzas.id).catch(
      () => 0,
    );
    expect(orphans).toBe(0);
    expect((await readRaw("products", plainProduct.id)).isAvailable).toBe(false);
  });
});

describe("store isolation", () => {
  it("denies access to the other store's menu and categories", async () => {
    await expect(getMenuByStoreId(otherStore.storeId)).rejects.toThrow();
    await expect(getCategoriesByMenuId(otherStore.menu.id)).rejects.toThrow();
    await expect(readRaw("menus", otherStore.menu.id)).rejects.toThrow();
  });
});

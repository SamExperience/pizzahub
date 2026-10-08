// @vitest-environment node
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/services/firebase";
import { login, register, signout } from "../src/services/auth.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { createMenu } from "../src/services/menu.service";
import { createCategory } from "../src/services/category.service";
import { createProduct } from "../src/services/product.service";

const TEST_PASSWORD = "Password123!";

// Creates a workspace (Company, Store, User) with a Menu, Category and Product
// and leaves the new user signed in.
const createStoreWithMenu = async (label) => {
  const email = `test-rules-${label}-${Date.now()}@example.com`;
  const { user } = await register(email, TEST_PASSWORD);
  const { storeId } = await createOnboardingWorkspace({
    uid: user.uid,
    userName: user.displayName,
    companyName: `Rules ${label} Company`,
    storeName: `Rules ${label} Store`,
    street: "Rue du Lyon",
    streetNumber: "9",
    postalCode: "1201",
    city: "Genève",
    country: "Switzerland",
  });
  const menu = await createMenu(storeId, `Menu ${label}`);
  const category = await createCategory(menu.id, "Pizzas", 1);
  const product = await createProduct(category.id, {
    name: "Margherita",
    price: 10,
    isAvailable: true,
    position: 1,
  });
  return {
    email,
    storeId,
    menuId: menu.id,
    categoryId: category.id,
    productId: product.id,
  };
};

let storeA;
let storeB;

beforeAll(async () => {
  storeA = await createStoreWithMenu("a");
  storeB = await createStoreWithMenu("b");
});

// Signs in as the owner of store A or B.
const signInAs = async (store) => {
  await signout();
  await login(store.email, TEST_PASSWORD);
};

describe("menus rules", () => {
  it("lets the owner read and update the menu", async () => {
    await signInAs(storeA);
    const ref = doc(db, "menus", storeA.menuId);
    expect((await getDoc(ref)).exists()).toBe(true);
    await expect(updateDoc(ref, { name: "Renamed" })).resolves.toBeUndefined();
  });

  it("denies another store read, update and delete", async () => {
    await signInAs(storeB);
    const ref = doc(db, "menus", storeA.menuId);
    await expect(getDoc(ref)).rejects.toThrow();
    await expect(updateDoc(ref, { name: "Hacked" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies creating a menu for another store", async () => {
    await signInAs(storeB);
    await expect(
      addDoc(collection(db, "menus"), { storeId: storeA.storeId, name: "X" }),
    ).rejects.toThrow();
  });

  it("denies moving the menu to another store", async () => {
    await signInAs(storeA);
    const ref = doc(db, "menus", storeA.menuId);
    await expect(updateDoc(ref, { storeId: storeB.storeId })).rejects.toThrow();
  });
});

describe("categories rules", () => {
  it("lets the owner read and update the category", async () => {
    await signInAs(storeA);
    const ref = doc(db, "categories", storeA.categoryId);
    expect((await getDoc(ref)).exists()).toBe(true);
    await expect(updateDoc(ref, { name: "Renamed" })).resolves.toBeUndefined();
  });

  it("denies another store read, update and delete", async () => {
    await signInAs(storeB);
    const ref = doc(db, "categories", storeA.categoryId);
    await expect(getDoc(ref)).rejects.toThrow();
    await expect(updateDoc(ref, { name: "Hacked" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies creating a category in another store's menu", async () => {
    await signInAs(storeB);
    await expect(
      addDoc(collection(db, "categories"), {
        menuId: storeA.menuId,
        name: "X",
        position: 9,
      }),
    ).rejects.toThrow();
  });

  it("denies changing the menuId", async () => {
    await signInAs(storeA);
    const ref = doc(db, "categories", storeA.categoryId);
    await expect(updateDoc(ref, { menuId: storeB.menuId })).rejects.toThrow();
  });
});

describe("products rules", () => {
  it("lets the owner read and update the product", async () => {
    await signInAs(storeA);
    const ref = doc(db, "products", storeA.productId);
    expect((await getDoc(ref)).exists()).toBe(true);
    await expect(updateDoc(ref, { name: "Renamed" })).resolves.toBeUndefined();
  });

  it("denies another store read, update and delete", async () => {
    await signInAs(storeB);
    const ref = doc(db, "products", storeA.productId);
    await expect(getDoc(ref)).rejects.toThrow();
    await expect(updateDoc(ref, { name: "Hacked" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies creating a product in another store's category", async () => {
    await signInAs(storeB);
    await expect(
      addDoc(collection(db, "products"), {
        categoryId: storeA.categoryId,
        name: "X",
        price: 1,
      }),
    ).rejects.toThrow();
  });

  it("denies changing the categoryId", async () => {
    await signInAs(storeA);
    const ref = doc(db, "products", storeA.productId);
    await expect(
      updateDoc(ref, { categoryId: storeB.categoryId }),
    ).rejects.toThrow();
  });
});

describe("unauthenticated access", () => {
  it("denies reading menus, categories and products", async () => {
    await signout();
    await expect(getDoc(doc(db, "menus", storeA.menuId))).rejects.toThrow();
    await expect(
      getDoc(doc(db, "categories", storeA.categoryId)),
    ).rejects.toThrow();
    await expect(
      getDoc(doc(db, "products", storeA.productId)),
    ).rejects.toThrow();
  });

  it("denies deleting the menu", async () => {
    await signout();
    await expect(deleteDoc(doc(db, "menus", storeA.menuId))).rejects.toThrow();
  });
});

describe("owner delete", () => {
  it("lets the owner delete product, category and menu", async () => {
    await signInAs(storeA);
    await deleteDoc(doc(db, "products", storeA.productId));
    await deleteDoc(doc(db, "categories", storeA.categoryId));
    await deleteDoc(doc(db, "menus", storeA.menuId));
    await expect(
      getDoc(doc(db, "menus", storeA.menuId)),
    ).rejects.toThrow();
  });
});

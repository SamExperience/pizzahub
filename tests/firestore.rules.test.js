// @vitest-environment node
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { beforeAll, describe, expect, it } from "vitest";
import { app, auth, db } from "../src/services/firebase";
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

// Orders and customers are read-only for clients, so they are seeded through
// the Firestore emulator REST API, which bypasses the rules ("Bearer owner").
const seedDoc = async (collectionName, fields) => {
  const url = `http://localhost:8080/v1/projects/${app.options.projectId}/databases/(default)/documents/${collectionName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          key,
          { stringValue: value },
        ]),
      ),
    }),
  });
  if (!response.ok) throw new Error(`Seeding ${collectionName} failed`);
  const { name } = await response.json();
  return name.split("/").pop();
};

describe("orders and customers rules", () => {
  let orderAId;
  let orderBId;
  let customerAId;

  beforeAll(async () => {
    await signInAs(storeA);
    const profile = await getDoc(doc(db, "users", auth.currentUser.uid));
    const companyId = profile.data().companyId;
    orderAId = await seedDoc("orders", { storeId: storeA.storeId });
    orderBId = await seedDoc("orders", { storeId: storeB.storeId });
    customerAId = await seedDoc("customers", { companyId });
  });

  it("lets the owner read and query their store's orders", async () => {
    await signInAs(storeA);
    expect((await getDoc(doc(db, "orders", orderAId))).exists()).toBe(true);
    const snapshot = await getDocs(
      query(collection(db, "orders"), where("storeId", "==", storeA.storeId)),
    );
    expect(snapshot.docs.map((d) => d.id)).toEqual([orderAId]);
  });

  it("denies another store reading or querying the orders", async () => {
    await signInAs(storeB);
    await expect(getDoc(doc(db, "orders", orderAId))).rejects.toThrow();
    await expect(
      getDocs(
        query(collection(db, "orders"), where("storeId", "==", storeA.storeId)),
      ),
    ).rejects.toThrow();
    expect((await getDoc(doc(db, "orders", orderBId))).exists()).toBe(true);
  });

  it("denies the owner creating, updating and deleting orders", async () => {
    await signInAs(storeA);
    const ref = doc(db, "orders", orderAId);
    await expect(
      addDoc(collection(db, "orders"), { storeId: storeA.storeId }),
    ).rejects.toThrow();
    await expect(updateDoc(ref, { status: "Completed" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("lets the owner read their company's customers", async () => {
    await signInAs(storeA);
    expect(
      (await getDoc(doc(db, "customers", customerAId))).exists(),
    ).toBe(true);
  });

  it("denies another company reading the customers", async () => {
    await signInAs(storeB);
    await expect(getDoc(doc(db, "customers", customerAId))).rejects.toThrow();
  });

  it("denies the owner writing customers", async () => {
    await signInAs(storeA);
    const ref = doc(db, "customers", customerAId);
    await expect(
      addDoc(collection(db, "customers"), { firstName: "X" }),
    ).rejects.toThrow();
    await expect(updateDoc(ref, { firstName: "X" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies unauthenticated reads", async () => {
    await signout();
    await expect(getDoc(doc(db, "orders", orderAId))).rejects.toThrow();
    await expect(getDoc(doc(db, "customers", customerAId))).rejects.toThrow();
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

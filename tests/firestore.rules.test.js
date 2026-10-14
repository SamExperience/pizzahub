// @vitest-environment node
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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
  const { storeId, companyId } = await createOnboardingWorkspace({
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
    uid: user.uid,
    companyId,
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
// An optional documentId fixes the id of the seeded document.
const seedDoc = async (collectionName, fields, documentId) => {
  const query = documentId ? `?documentId=${documentId}` : "";
  const url = `http://localhost:8080/v1/projects/${app.options.projectId}/databases/(default)/documents/${collectionName}${query}`;
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

  it("denies the owner deleting orders or updating them without updatedAt", async () => {
    await signInAs(storeA);
    const ref = doc(db, "orders", orderAId);
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

  it("denies unauthenticated reads", async () => {
    await signout();
    await expect(getDoc(doc(db, "orders", orderAId))).rejects.toThrow();
    await expect(getDoc(doc(db, "customers", customerAId))).rejects.toThrow();
  });
});

// Writes go through a batch with server timestamps, as in the services.
const deliveryAddress = {
  street: "Rue du Lyon",
  streetNumber: "9",
  postalCode: "1201",
  city: "Genève",
  country: null,
};

const customerFields = (companyId, extra = {}) => ({
  companyId,
  firstName: "Mario",
  lastName: null,
  phone: "0123456789",
  address: deliveryAddress,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const orderFields = (storeId, customerId, extra = {}) => ({
  storeId,
  customerId,
  orderType: "takeaway",
  scheduledTime: new Date(Date.now() + 30 * 60 * 1000),
  status: "Pending",
  items: [{ productId: "p1", productName: "Margherita", quantity: 1 }],
  total: 10,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

describe("orders and customers write rules", () => {
  let companyA;
  let companyB;

  beforeAll(async () => {
    await signInAs(storeA);
    companyA = (await getDoc(doc(db, "users", auth.currentUser.uid))).data()
      .companyId;
    await signInAs(storeB);
    companyB = (await getDoc(doc(db, "users", auth.currentUser.uid))).data()
      .companyId;
  });

  // Creates a Customer through the rules and returns its id.
  const createCustomer = async (extra) => {
    const ref = doc(collection(db, "customers"));
    await writeBatch(db).set(ref, customerFields(companyA, extra)).commit();
    return ref.id;
  };

  // Commits an Order and, when customerData is given, its Customer in the
  // same batch. Returns the Order id.
  const commitOrder = async (order, customerData) => {
    const batch = writeBatch(db);
    const customerRef = doc(collection(db, "customers"));
    const orderRef = doc(collection(db, "orders"));

    if (customerData) batch.set(customerRef, customerData);

    batch.set(orderRef, order(customerData ? customerRef.id : null));
    await batch.commit();

    return orderRef.id;
  };

  it("lets the owner create and update a customer", async () => {
    await signInAs(storeA);
    const id = await createCustomer();
    await expect(
      updateDoc(doc(db, "customers", id), {
        firstName: "Luigi",
        updatedAt: serverTimestamp(),
      }),
    ).resolves.toBeUndefined();
  });

  it("denies creating an invalid customer", async () => {
    await signInAs(storeA);
    const create = (fields) =>
      writeBatch(db).set(doc(collection(db, "customers")), fields).commit();

    await expect(create(customerFields(companyB))).rejects.toThrow();
    await expect(create(customerFields(companyA, { firstName: "" }))).rejects.toThrow();
    await expect(create(customerFields(companyA, { firstName: null }))).rejects.toThrow();
    await expect(create(customerFields(companyA, { extra: "x" }))).rejects.toThrow();
  });

  it("denies another company updating or deleting a customer", async () => {
    await signInAs(storeA);
    const id = await createCustomer();
    await signInAs(storeB);
    const ref = doc(db, "customers", id);
    await expect(
      updateDoc(ref, { firstName: "Hacked", updatedAt: serverTimestamp() }),
    ).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies changing the customer's companyId and deleting it", async () => {
    await signInAs(storeA);
    const ref = doc(db, "customers", await createCustomer());
    await expect(
      updateDoc(ref, { companyId: companyB, updatedAt: serverTimestamp() }),
    ).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("lets the owner create a takeaway order with a new customer", async () => {
    await signInAs(storeA);
    const id = await commitOrder(
      (customerId) => orderFields(storeA.storeId, customerId),
      customerFields(companyA, { phone: null, address: null }),
    );
    expect((await getDoc(doc(db, "orders", id))).data().status).toBe("Pending");
  });

  it("lets the owner create a delivery order for an existing customer", async () => {
    await signInAs(storeA);
    const customerId = await createCustomer();
    await commitOrder(() =>
      orderFields(storeA.storeId, customerId, { orderType: "delivery" }),
    );
  });

  it("denies a delivery order without phone or address", async () => {
    await signInAs(storeA);
    const delivery = (customerId) =>
      orderFields(storeA.storeId, customerId, { orderType: "delivery" });

    await expect(
      commitOrder(delivery, customerFields(companyA, { phone: null })),
    ).rejects.toThrow();
    await expect(
      commitOrder(delivery, customerFields(companyA, { address: null })),
    ).rejects.toThrow();
  });

  it("denies invalid orders", async () => {
    await signInAs(storeA);
    const customer = () => customerFields(companyA);
    const invalid = (extra) =>
      commitOrder(
        (customerId) => orderFields(storeA.storeId, customerId, extra),
        customer(),
      );

    await expect(invalid({ storeId: storeB.storeId })).rejects.toThrow();
    await expect(invalid({ status: "Completed" })).rejects.toThrow();
    await expect(invalid({ items: [] })).rejects.toThrow();
    await expect(invalid({ orderType: "dinein" })).rejects.toThrow();
    await expect(invalid({ extra: "x" })).rejects.toThrow();
  });

  it("denies an order referencing another company's customer", async () => {
    await signInAs(storeB);
    const customerId = await createCustomerForB();
    await signInAs(storeA);
    await expect(
      commitOrder(() => orderFields(storeA.storeId, customerId)),
    ).rejects.toThrow();
  });

  it("denies unauthenticated order and customer creation", async () => {
    await signout();
    await expect(
      writeBatch(db)
        .set(doc(collection(db, "customers")), customerFields(companyA))
        .commit(),
    ).rejects.toThrow();
    await expect(
      writeBatch(db)
        .set(doc(collection(db, "orders")), orderFields(storeA.storeId, "x"))
        .commit(),
    ).rejects.toThrow();
  });

  // Customer of Company B, created while signed in as B.
  const createCustomerForB = async () => {
    const ref = doc(collection(db, "customers"));
    await writeBatch(db).set(ref, customerFields(companyB)).commit();
    return ref.id;
  };

  // Takeaway Order of store A for a new Customer; returns its reference.
  const createOrderA = async () => {
    await signInAs(storeA);
    const id = await commitOrder(
      (customerId) => orderFields(storeA.storeId, customerId),
      customerFields(companyA, { phone: null, address: null }),
    );
    return doc(db, "orders", id);
  };

  // Status change as written by updateOrderStatus and cancelOrder.
  const setStatus = (ref, status) =>
    updateDoc(ref, {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "Completed" && { completedAt: serverTimestamp() }),
      ...((status === "Pending" || status === "In progress") && { completedAt: null }),
    });

  // Content edit as written by updateOrder.
  const editContent = (ref, customerId, extra = {}) =>
    updateDoc(ref, {
      customerId,
      orderType: "takeaway",
      scheduledTime: new Date(Date.now() + 60 * 60 * 1000),
      items: [{ productId: "p1", productName: "Margherita", quantity: 2 }],
      total: 20,
      updatedAt: serverTimestamp(),
      ...extra,
    });

  it("lets the owner change the status of an order and cancel it", async () => {
    const ref = await createOrderA();
    await setStatus(ref, "In progress");
    await setStatus(ref, "Completed");
    await setStatus(ref, "Pending");
    await setStatus(ref, "Cancelled");
    expect((await getDoc(ref)).data().status).toBe("Cancelled");
  });

  it("records completedAt on completion and clears it when moving back", async () => {
    const ref = await createOrderA();
    await setStatus(ref, "In progress");
    await setStatus(ref, "Completed");
    expect((await getDoc(ref)).data().completedAt).toBeTruthy();
    await setStatus(ref, "In progress");
    expect((await getDoc(ref)).data().completedAt).toBeNull();
    await setStatus(ref, "Completed");
    await setStatus(ref, "Cancelled");
    expect((await getDoc(ref)).data().completedAt).toBeTruthy();
  });

  it("denies an invalid completedAt", async () => {
    const ref = await createOrderA();
    const update = (data) => updateDoc(ref, { updatedAt: serverTimestamp(), ...data });

    await expect(update({ status: "Completed" })).rejects.toThrow();
    await expect(
      update({ status: "Completed", completedAt: new Date(2020, 0, 1) }),
    ).rejects.toThrow();
    await expect(
      update({ status: "In progress", completedAt: serverTimestamp() }),
    ).rejects.toThrow();
    await expect(
      update({ status: "Cancelled", completedAt: serverTimestamp() }),
    ).rejects.toThrow();
    await setStatus(ref, "Completed");
    await expect(update({ status: "In progress" })).rejects.toThrow();
  });

  it("denies an unknown status and a status change with other fields", async () => {
    const ref = await createOrderA();
    await expect(setStatus(ref, "Done")).rejects.toThrow();
    await expect(
      updateDoc(ref, { status: "Completed", total: 1, updatedAt: serverTimestamp() }),
    ).rejects.toThrow();
  });

  it("denies any update of a cancelled order", async () => {
    const ref = await createOrderA();
    const { customerId } = (await getDoc(ref)).data();
    await setStatus(ref, "Cancelled");
    await expect(setStatus(ref, "Pending")).rejects.toThrow();
    await expect(editContent(ref, customerId)).rejects.toThrow();
  });

  it("lets the owner edit an order with an existing customer", async () => {
    const ref = await createOrderA();
    const customerId = await createCustomer();
    await editContent(ref, customerId, { orderType: "delivery" });
    const order = (await getDoc(ref)).data();
    expect(order).toMatchObject({ customerId, orderType: "delivery", total: 20 });
    expect(order.status).toBe("Pending");
  });

  it("lets the owner edit an order with a new customer in one batch", async () => {
    const ref = await createOrderA();
    const customerRef = doc(collection(db, "customers"));
    await writeBatch(db)
      .set(customerRef, customerFields(companyA))
      .update(ref, {
        customerId: customerRef.id,
        orderType: "delivery",
        updatedAt: serverTimestamp(),
      })
      .commit();
    expect((await getDoc(ref)).data().customerId).toBe(customerRef.id);
  });

  it("denies invalid order edits", async () => {
    const ref = await createOrderA();
    const { customerId } = (await getDoc(ref)).data();
    const noDetails = await createCustomer({ phone: null, address: null });

    await expect(
      editContent(ref, noDetails, { orderType: "delivery" }),
    ).rejects.toThrow();
    await expect(editContent(ref, customerId, { items: [] })).rejects.toThrow();
    await expect(editContent(ref, customerId, { orderType: "dinein" })).rejects.toThrow();
    await expect(editContent(ref, customerId, { extra: "x" })).rejects.toThrow();
    await expect(
      editContent(ref, customerId, { storeId: storeB.storeId }),
    ).rejects.toThrow();
    await expect(
      editContent(ref, customerId, { createdAt: serverTimestamp() }),
    ).rejects.toThrow();
    await expect(
      editContent(ref, customerId, { status: "Completed" }),
    ).rejects.toThrow();
  });

  it("denies editing an order with another company's customer", async () => {
    const ref = await createOrderA();
    await signInAs(storeB);
    const customerB = await createCustomerForB();
    await signInAs(storeA);
    await expect(editContent(ref, customerB)).rejects.toThrow();
  });

  it("denies another store updating or deleting an order", async () => {
    const ref = await createOrderA();
    const { customerId } = (await getDoc(ref)).data();
    await signInAs(storeB);
    await expect(setStatus(ref, "Completed")).rejects.toThrow();
    await expect(setStatus(ref, "Cancelled")).rejects.toThrow();
    await expect(editContent(ref, customerId)).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies the owner deleting an order", async () => {
    const ref = await createOrderA();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies unauthenticated order updates", async () => {
    const ref = await createOrderA();
    await signout();
    await expect(setStatus(ref, "Completed")).rejects.toThrow();
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

// Registers a new account (left signed in) without onboarding it.
const registerAccount = async (label) => {
  await signout();
  const email = `test-rules-${label}-${Date.now()}@example.com`;
  const { user } = await register(email, TEST_PASSWORD);
  return { uid: user.uid, email };
};

const onboard = (uid, label) =>
  createOnboardingWorkspace({
    uid,
    userName: "Test User",
    companyName: `Rules ${label} Company`,
    storeName: `Rules ${label} Store`,
    street: "Rue du Lyon",
    streetNumber: "9",
    postalCode: "1201",
    city: "Genève",
    country: "Switzerland",
  });

// Raw onboarding writes in one batch. Overrides tweak the documents; `omit`
// lists documents to leave out ("company", "store", "user").
const commitRawWorkspace = ({
  uid,
  userId = uid,
  company = {},
  store = {},
  user = {},
  omit = [],
}) => {
  const companyRef = doc(collection(db, "companies"));
  const storeRef = doc(collection(db, "stores"));
  const userRef = doc(db, "users", userId);
  const batch = writeBatch(db);

  if (!omit.includes("company")) {
    batch.set(companyRef, {
      name: "Raw Company",
      logoUrl: null,
      address: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...company,
    });
  }
  if (!omit.includes("store")) {
    batch.set(storeRef, {
      name: "Raw Store",
      address: null,
      companyId: companyRef.id,
      isActive: true,
      imageUrl: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...store,
    });
  }
  if (!omit.includes("user")) {
    batch.set(userRef, {
      uid,
      companyId: companyRef.id,
      storeId: storeRef.id,
      role: "admin",
      displayName: "Raw User",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...user,
    });
  }
  return batch.commit();
};

describe("companies, stores and users rules", () => {
  it("lets a fresh account onboard its Company, Store and User", async () => {
    const user = await registerAccount("fresh");
    const { companyId, storeId } = await onboard(user.uid, "fresh");

    expect((await getDoc(doc(db, "companies", companyId))).exists()).toBe(true);
    expect((await getDoc(doc(db, "stores", storeId))).exists()).toBe(true);
    expect(
      (await getDoc(doc(db, "users", user.uid))).data(),
    ).toMatchObject({ companyId, storeId, role: "admin" });
  });

  it("lets the owner read own documents and denies foreign ones", async () => {
    await signInAs(storeA);
    expect((await getDoc(doc(db, "companies", storeA.companyId))).exists()).toBe(true);
    expect((await getDoc(doc(db, "stores", storeA.storeId))).exists()).toBe(true);
    expect((await getDoc(doc(db, "users", storeA.uid))).exists()).toBe(true);

    await expect(getDoc(doc(db, "companies", storeB.companyId))).rejects.toThrow();
    await expect(getDoc(doc(db, "stores", storeB.storeId))).rejects.toThrow();
    await expect(getDoc(doc(db, "users", storeB.uid))).rejects.toThrow();
  });

  it("denies changing or deleting the own profile", async () => {
    await signInAs(storeA);
    const ref = doc(db, "users", storeA.uid);
    const change = (data) =>
      updateDoc(ref, { ...data, updatedAt: serverTimestamp() });

    await expect(change({ companyId: storeB.companyId })).rejects.toThrow();
    await expect(change({ storeId: storeB.storeId })).rejects.toThrow();
    await expect(change({ role: "owner" })).rejects.toThrow();
    await expect(change({ displayName: "Renamed" })).rejects.toThrow();
    await expect(
      setDoc(ref, {
        uid: storeA.uid,
        companyId: storeA.companyId,
        storeId: storeA.storeId,
        role: "admin",
        displayName: "Overwritten",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies updating or deleting a Company and a Store", async () => {
    const companyRef = doc(db, "companies", storeA.companyId);
    const storeRef = doc(db, "stores", storeA.storeId);
    const attempt = async () => {
      await expect(updateDoc(companyRef, { name: "Hacked" })).rejects.toThrow();
      await expect(deleteDoc(companyRef)).rejects.toThrow();
      await expect(updateDoc(storeRef, { name: "Hacked" })).rejects.toThrow();
      await expect(
        updateDoc(storeRef, { companyId: storeB.companyId }),
      ).rejects.toThrow();
      await expect(deleteDoc(storeRef)).rejects.toThrow();
    };

    await signInAs(storeA);
    await attempt();
    await signInAs(storeB);
    await attempt();
    await signout();
    await attempt();
  });

  it("denies creating invalid workspaces", async () => {
    const user = await registerAccount("invalid");
    const uid = user.uid;

    await expect(
      commitRawWorkspace({ uid, user: { role: "staff" } }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, user: { uid: "someone-else" } }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, userId: storeA.uid }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, omit: ["store", "user"] }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, omit: ["company", "user"] }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, omit: ["company", "store"] }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, store: { companyId: storeA.companyId } }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, omit: ["store"], user: { storeId: storeA.storeId } }),
    ).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid, omit: ["company"], user: { companyId: storeA.companyId } }),
    ).rejects.toThrow();

    // The valid workspace still succeeds afterwards.
    await commitRawWorkspace({ uid });
  });

  it("denies a second onboarding by an already onboarded user", async () => {
    await signInAs(storeA);
    await expect(
      commitRawWorkspace({ uid: storeA.uid }),
    ).rejects.toThrow();
    await expect(onboard(storeA.uid, "again")).rejects.toThrow();
    expect((await getDoc(doc(db, "users", storeA.uid))).data().storeId).toBe(
      storeA.storeId,
    );
  });

  describe("second account next to an existing admin", () => {
    let second;

    beforeAll(async () => {
      second = await registerAccount("second");
    });

    const asSecond = async () => {
      await signout();
      await login(second.email, TEST_PASSWORD);
    };

    it("denies joining the existing Company and Store", async () => {
      await asSecond();
      await expect(
        setDoc(doc(db, "users", second.uid), {
          uid: second.uid,
          companyId: storeA.companyId,
          storeId: storeA.storeId,
          role: "admin",
          displayName: "Intruder",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ).rejects.toThrow();
    });

    it("denies joining the existing Company with a new Store", async () => {
      await asSecond();
      await expect(
        commitRawWorkspace({
          uid: second.uid,
          omit: ["company"],
          user: { companyId: storeA.companyId },
          store: { companyId: storeA.companyId },
        }),
      ).rejects.toThrow();
    });

    it("denies creating a Store under the existing Company", async () => {
      await asSecond();
      await expect(
        setDoc(doc(collection(db, "stores")), {
          name: "Intruder Store",
          address: null,
          companyId: storeA.companyId,
          isActive: true,
          imageUrl: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ).rejects.toThrow();
    });

    it("denies reading or writing the existing workspace data", async () => {
      await asSecond();
      const orderId = await seedDoc("orders", { storeId: storeA.storeId });
      const targets = [
        doc(db, "companies", storeA.companyId),
        doc(db, "stores", storeA.storeId),
        doc(db, "users", storeA.uid),
        doc(db, "menus", storeA.menuId),
        doc(db, "categories", storeA.categoryId),
        doc(db, "products", storeA.productId),
        doc(db, "orders", orderId),
      ];

      for (const ref of targets) {
        await expect(getDoc(ref)).rejects.toThrow();
        await expect(updateDoc(ref, { name: "Hacked" })).rejects.toThrow();
        await expect(deleteDoc(ref)).rejects.toThrow();
      }
      await expect(
        addDoc(collection(db, "menus"), { storeId: storeA.storeId, name: "X" }),
      ).rejects.toThrow();
    });

    it("lets the second account onboard its own Company and Store", async () => {
      await asSecond();
      const { companyId, storeId } = await onboard(second.uid, "second");
      expect(companyId).not.toBe(storeA.companyId);
      expect(storeId).not.toBe(storeA.storeId);
      expect((await getDoc(doc(db, "stores", storeId))).exists()).toBe(true);
      await expect(
        getDoc(doc(db, "stores", storeA.storeId)),
      ).rejects.toThrow();
    });
  });

  it("denies unauthenticated reads and creates", async () => {
    await signout();
    await expect(getDoc(doc(db, "companies", storeA.companyId))).rejects.toThrow();
    await expect(getDoc(doc(db, "stores", storeA.storeId))).rejects.toThrow();
    await expect(getDoc(doc(db, "users", storeA.uid))).rejects.toThrow();
    await expect(
      commitRawWorkspace({ uid: "anonymous-uid" }),
    ).rejects.toThrow();
    await expect(
      setDoc(doc(collection(db, "companies")), {
        name: "X",
        createdAt: serverTimestamp(),
      }),
    ).rejects.toThrow();
    await expect(
      setDoc(doc(collection(db, "stores")), {
        name: "X",
        companyId: storeA.companyId,
        createdAt: serverTimestamp(),
      }),
    ).rejects.toThrow();
    await expect(
      setDoc(doc(db, "users", storeA.uid), { uid: storeA.uid, role: "admin" }),
    ).rejects.toThrow();
  });
});

describe("non-admin profile", () => {
  let staff;
  let order;
  let customerId;

  // Order and Customer of store A written by its admin; the staff profile
  // then attempts the same writes on them.
  beforeAll(async () => {
    await signInAs(storeA);
    const customerRef = doc(collection(db, "customers"));
    const orderRef = doc(collection(db, "orders"));
    await writeBatch(db)
      .set(
        customerRef,
        customerFields(storeA.companyId, { phone: null, address: null }),
      )
      .set(orderRef, orderFields(storeA.storeId, customerRef.id))
      .commit();
    customerId = customerRef.id;
    order = orderRef;

    // Staff profile linked to store A, seeded with the rules bypassed.
    const account = await registerAccount("staff");
    await seedDoc(
      "users",
      {
        uid: account.uid,
        companyId: storeA.companyId,
        storeId: storeA.storeId,
        role: "staff",
      },
      account.uid,
    );
    staff = account;
  });

  const signInAsStaff = () => signInAs(staff);

  it("lets the profile read its store's menu, category, product, orders and customers", async () => {
    await signInAsStaff();
    expect((await getDoc(doc(db, "menus", storeA.menuId))).exists()).toBe(true);
    expect(
      (await getDoc(doc(db, "categories", storeA.categoryId))).exists(),
    ).toBe(true);
    expect(
      (await getDoc(doc(db, "products", storeA.productId))).exists(),
    ).toBe(true);
    expect((await getDoc(order)).exists()).toBe(true);
    expect((await getDoc(doc(db, "customers", customerId))).exists()).toBe(
      true,
    );
    const snapshot = await getDocs(
      query(collection(db, "orders"), where("storeId", "==", storeA.storeId)),
    );
    expect(snapshot.docs.map((d) => d.id)).toContain(order.id);
  });

  it("denies creating, updating and deleting menus", async () => {
    await signInAsStaff();
    const ref = doc(db, "menus", storeA.menuId);
    await expect(
      addDoc(collection(db, "menus"), { storeId: storeA.storeId, name: "X" }),
    ).rejects.toThrow();
    await expect(updateDoc(ref, { name: "Staff" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies creating, updating and deleting categories", async () => {
    await signInAsStaff();
    const ref = doc(db, "categories", storeA.categoryId);
    await expect(
      addDoc(collection(db, "categories"), {
        menuId: storeA.menuId,
        name: "X",
        position: 9,
      }),
    ).rejects.toThrow();
    await expect(updateDoc(ref, { name: "Staff" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies creating, updating and deleting products", async () => {
    await signInAsStaff();
    const ref = doc(db, "products", storeA.productId);
    await expect(
      addDoc(collection(db, "products"), {
        categoryId: storeA.categoryId,
        name: "X",
        price: 1,
      }),
    ).rejects.toThrow();
    await expect(updateDoc(ref, { name: "Staff" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
  });

  it("denies creating, changing the status of and editing orders", async () => {
    await signInAsStaff();
    await expect(
      writeBatch(db)
        .set(
          doc(collection(db, "orders")),
          orderFields(storeA.storeId, customerId),
        )
        .commit(),
    ).rejects.toThrow();
    await expect(
      updateDoc(order, {
        status: "In progress",
        updatedAt: serverTimestamp(),
        completedAt: null,
      }),
    ).rejects.toThrow();
    await expect(
      updateDoc(order, {
        customerId,
        orderType: "takeaway",
        scheduledTime: new Date(Date.now() + 60 * 60 * 1000),
        items: [{ productId: "p1", productName: "Margherita", quantity: 2 }],
        total: 20,
        updatedAt: serverTimestamp(),
      }),
    ).rejects.toThrow();
    await expect(deleteDoc(order)).rejects.toThrow();
  });

  it("denies creating and updating customers", async () => {
    await signInAsStaff();
    await expect(
      writeBatch(db)
        .set(doc(collection(db, "customers")), customerFields(storeA.companyId))
        .commit(),
    ).rejects.toThrow();
    await expect(
      updateDoc(doc(db, "customers", customerId), {
        firstName: "Staff",
        updatedAt: serverTimestamp(),
      }),
    ).rejects.toThrow();
  });

  it("still lets the admin owner of the store write", async () => {
    await signInAs(storeA);
    await expect(
      updateDoc(doc(db, "menus", storeA.menuId), { name: "Admin" }),
    ).resolves.toBeUndefined();
    await expect(
      updateDoc(order, {
        status: "In progress",
        updatedAt: serverTimestamp(),
        completedAt: null,
      }),
    ).resolves.toBeUndefined();
    await expect(
      updateDoc(doc(db, "customers", customerId), {
        firstName: "Admin",
        updatedAt: serverTimestamp(),
      }),
    ).resolves.toBeUndefined();
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

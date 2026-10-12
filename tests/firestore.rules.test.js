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

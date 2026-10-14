// @vitest-environment node
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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
import { FIELD_LIMITS } from "../src/utils/fieldLimits";

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
    await expect(
      updateDoc(ref, { name: "Renamed", updatedAt: serverTimestamp() }),
    ).resolves.toBeUndefined();
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
    await expect(
      updateDoc(ref, { storeId: storeB.storeId, updatedAt: serverTimestamp() }),
    ).rejects.toThrow();
  });
});

describe("categories rules", () => {
  it("lets the owner read and update the category", async () => {
    await signInAs(storeA);
    const ref = doc(db, "categories", storeA.categoryId);
    expect((await getDoc(ref)).exists()).toBe(true);
    await expect(
      updateDoc(ref, { name: "Renamed", updatedAt: serverTimestamp() }),
    ).resolves.toBeUndefined();
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
    await expect(
      updateDoc(ref, { name: "Renamed", updatedAt: serverTimestamp() }),
    ).resolves.toBeUndefined();
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

  it("denies a delivery order with a blank phone or address part", async () => {
    await signInAs(storeA);
    const delivery = (customerId) =>
      orderFields(storeA.storeId, customerId, { orderType: "delivery" });
    const blankAddress = (part) => ({ ...deliveryAddress, [part]: "   " });

    await expect(
      commitOrder(delivery, customerFields(companyA, { phone: "   " })),
    ).rejects.toThrow();
    for (const part of ["street", "streetNumber", "postalCode", "city"]) {
      await expect(
        commitOrder(
          delivery,
          customerFields(companyA, { address: blankAddress(part) }),
        ),
      ).rejects.toThrow();
    }
    // A blank optional part (country) does not block the delivery.
    await commitOrder(
      delivery,
      customerFields(companyA, { address: blankAddress("country") }),
    );
    // Takeaway orders do not need delivery details.
    await commitOrder(
      (customerId) => orderFields(storeA.storeId, customerId),
      customerFields(companyA, { phone: "   ", address: null }),
    );
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

  describe("customer validation", () => {
    const { NAME, PHONE, POSTAL_CODE } = FIELD_LIMITS;
    const create = (extra = {}, omitKey) => {
      const data = customerFields(companyA, extra);
      if (omitKey) delete data[omitKey];
      return writeBatch(db).set(doc(collection(db, "customers")), data).commit();
    };

    it("denies a missing required key or an extra key on creation", async () => {
      await signInAs(storeA);
      for (const key of ["companyId", "firstName", "createdAt", "updatedAt"])
        await expect(create({}, key)).rejects.toThrow();
      await expect(create({ extra: "x" })).rejects.toThrow();
    });

    it("validates the values on creation", async () => {
      await signInAs(storeA);
      await expect(create({ firstName: "" })).rejects.toThrow();
      await expect(create({ firstName: "   " })).rejects.toThrow();
      await expect(create({ firstName: "a".repeat(NAME + 1) })).rejects.toThrow();
      await expect(create({ lastName: "a".repeat(NAME + 1) })).rejects.toThrow();
      await expect(create({ phone: "1".repeat(PHONE + 1) })).rejects.toThrow();
      await expect(
        create({
          address: {
            ...deliveryAddress,
            postalCode: "1".repeat(POSTAL_CODE + 1),
          },
        }),
      ).rejects.toThrow();
      await expect(
        create({ address: { ...deliveryAddress, planet: "Mars" } }),
      ).rejects.toThrow();
      await expect(create({ firstName: "a".repeat(NAME) })).resolves.toBeUndefined();
      await expect(
        create({ lastName: "a".repeat(NAME), phone: "1".repeat(PHONE) }),
      ).resolves.toBeUndefined();
      await expect(
        create({ lastName: null, phone: null, address: null }),
      ).resolves.toBeUndefined();
    });

    describe("update", () => {
      let ref;
      const touch = (data = {}) =>
        updateDoc(ref, { updatedAt: serverTimestamp(), ...data });

      beforeAll(async () => {
        await signInAs(storeA);
        ref = doc(db, "customers", await createCustomer());
      });

      it("validates the changed values", async () => {
        await signInAs(storeA);
        await expect(touch({ firstName: "Luigi" })).resolves.toBeUndefined();
        await expect(touch({ lastName: null, phone: null })).resolves.toBeUndefined();
        await expect(touch({ address: null })).resolves.toBeUndefined();
        await expect(touch({ firstName: "   " })).rejects.toThrow();
        await expect(touch({ firstName: "a".repeat(NAME + 1) })).rejects.toThrow();
        await expect(touch({ phone: "1".repeat(PHONE + 1) })).rejects.toThrow();
        await expect(touch({ extra: "x" })).rejects.toThrow();
      });

      it("denies removing a required key", async () => {
        await signInAs(storeA);
        await expect(touch({ firstName: deleteField() })).rejects.toThrow();
      });

      it("denies changing companyId or createdAt", async () => {
        await signInAs(storeA);
        await expect(touch({ companyId: companyB })).rejects.toThrow();
        await expect(touch({ createdAt: serverTimestamp() })).rejects.toThrow();
      });

      it("denies an update without updatedAt set to the request time", async () => {
        await signInAs(storeA);
        await expect(updateDoc(ref, { firstName: "NoTime" })).rejects.toThrow();
        await expect(touch({ updatedAt: new Date() })).rejects.toThrow();
      });

      it("keeps legacy customers without timestamps updatable", async () => {
        await signInAs(storeA);
        const legacyId = await seedDoc("customers", {
          companyId: companyA,
          firstName: "Legacy",
        });
        await expect(
          updateDoc(doc(db, "customers", legacyId), {
            firstName: "Fixed",
            updatedAt: serverTimestamp(),
          }),
        ).resolves.toBeUndefined();
      });
    });
  });

  describe("order validation", () => {
    const MAX_ITEMS = FIELD_LIMITS.LIST_SIZE;
    const items = (size) =>
      Array.from({ length: size }, (_, i) => ({
        productId: `p${i}`,
        productName: "Margherita",
        quantity: 1,
      }));

    const createWith = async (extra, omitKey) => {
      const customerId = await createCustomer();
      const data = orderFields(storeA.storeId, customerId, extra);
      if (omitKey) delete data[omitKey];
      const ref = doc(collection(db, "orders"));
      await writeBatch(db).set(ref, data).commit();
      return ref;
    };

    it("validates the items count and the total on creation", async () => {
      await signInAs(storeA);
      await expect(createWith({ items: [] })).rejects.toThrow();
      await expect(createWith({ items: items(1) })).resolves.toBeDefined();
      await expect(createWith({ items: items(MAX_ITEMS) })).resolves.toBeDefined();
      await expect(createWith({ items: items(MAX_ITEMS + 1) })).rejects.toThrow();
      await expect(createWith({ total: -1 })).rejects.toThrow();
      await expect(createWith({ total: 0 })).resolves.toBeDefined();
    });

    it("denies a missing required key on creation", async () => {
      await signInAs(storeA);
      for (const key of [
        "storeId",
        "customerId",
        "orderType",
        "scheduledTime",
        "status",
        "items",
        "total",
        "createdAt",
        "updatedAt",
      ])
        await expect(createWith({}, key)).rejects.toThrow();
    });

    it("validates the items count and the total on content edit", async () => {
      const ref = await createOrderA();
      const { customerId } = (await getDoc(ref)).data();

      await expect(editContent(ref, customerId, { items: [] })).rejects.toThrow();
      await expect(
        editContent(ref, customerId, { items: items(MAX_ITEMS + 1) }),
      ).rejects.toThrow();
      await expect(editContent(ref, customerId, { total: -1 })).rejects.toThrow();
      await expect(
        editContent(ref, customerId, { items: items(1) }),
      ).resolves.toBeUndefined();
      await expect(
        editContent(ref, customerId, { items: items(MAX_ITEMS) }),
      ).resolves.toBeUndefined();
    });

    it("denies removing a required content key", async () => {
      const ref = await createOrderA();
      const { customerId } = (await getDoc(ref)).data();

      await expect(
        editContent(ref, customerId, { total: deleteField() }),
      ).rejects.toThrow();
      await expect(
        editContent(ref, customerId, { scheduledTime: deleteField() }),
      ).rejects.toThrow();
    });

    describe("legacy order without scheduledTime", () => {
      let ref;
      let customerId;

      beforeAll(async () => {
        await signInAs(storeA);
        customerId = await createCustomer();
        const id = await seedDoc("orders", {
          storeId: storeA.storeId,
          customerId,
          orderType: "takeaway",
          status: "Pending",
        });
        ref = doc(db, "orders", id);
      });

      it("denies a content edit that does not supply every content field", async () => {
        await signInAs(storeA);
        await expect(
          updateDoc(ref, {
            customerId,
            orderType: "takeaway",
            items: items(1),
            total: 10,
            updatedAt: serverTimestamp(),
          }),
        ).rejects.toThrow();
        await expect(
          updateDoc(ref, { total: 10, updatedAt: serverTimestamp() }),
        ).rejects.toThrow();
      });

      it("denies changing storeId or createdAt", async () => {
        await signInAs(storeA);
        await expect(
          editContent(ref, customerId, { storeId: storeB.storeId }),
        ).rejects.toThrow();
        await expect(
          editContent(ref, customerId, { createdAt: serverTimestamp() }),
        ).rejects.toThrow();
      });

      it("lets a content edit supply every content field", async () => {
        await signInAs(storeA);
        await expect(editContent(ref, customerId)).resolves.toBeUndefined();
      });
    });
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

const validStoreAddress = {
  street: "Rue du Lyon",
  streetNumber: "9",
  postalCode: "1201",
  city: "Genève",
  country: "Switzerland",
};

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
      address: validStoreAddress,
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
          address: validStoreAddress,
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

describe("field validation rules", () => {
  const { NAME } = FIELD_LIMITS;
  const atLimit = "a".repeat(NAME);
  const overLimit = "a".repeat(NAME + 1);
  let account;

  beforeAll(async () => {
    account = await registerAccount("limits");
  });

  const raw = async (overrides) => {
    await signInAs(account);
    return commitRawWorkspace({ uid: account.uid, ...overrides });
  };

  // Commits a valid workspace with one key removed from one entity.
  const withoutKey = async (entity, key) => {
    await signInAs(account);
    const companyRef = doc(collection(db, "companies"));
    const storeRef = doc(collection(db, "stores"));
    const docs = {
      company: {
        name: "C",
        logoUrl: null,
        address: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      store: {
        companyId: companyRef.id,
        name: "S",
        address: validStoreAddress,
        isActive: true,
        imageUrl: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      user: {
        uid: account.uid,
        companyId: companyRef.id,
        storeId: storeRef.id,
        role: "admin",
        displayName: "U",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    };
    delete docs[entity][key];
    return writeBatch(db)
      .set(companyRef, docs.company)
      .set(storeRef, docs.store)
      .set(doc(db, "users", account.uid), docs.user)
      .commit();
  };

  it("applies the name limit to Company and Store", async () => {
    for (const bad of [overLimit, "", "   "]) {
      await expect(raw({ company: { name: bad } })).rejects.toThrow();
      await expect(raw({ store: { name: bad } })).rejects.toThrow();
    }
    await expect(raw({ company: { name: 5 } })).rejects.toThrow();
  });

  it("denies unknown keys on every entity", async () => {
    await expect(raw({ company: { extra: "x" } })).rejects.toThrow();
    await expect(raw({ store: { extra: "x" } })).rejects.toThrow();
    await expect(raw({ user: { extra: "x" } })).rejects.toThrow();
  });

  it("denies a missing required key on every entity", async () => {
    const required = {
      company: ["name", "logoUrl", "address", "createdAt", "updatedAt"],
      store: [
        "companyId",
        "name",
        "address",
        "isActive",
        "imageUrl",
        "createdAt",
        "updatedAt",
      ],
      user: ["uid", "companyId", "storeId", "role", "createdAt", "updatedAt"],
    };

    for (const [entity, keys] of Object.entries(required)) {
      for (const key of keys) {
        await expect(withoutKey(entity, key)).rejects.toThrow();
      }
    }
  });

  it("validates the Store address", async () => {
    const address = (extra, omitKey) => {
      const value = { ...validStoreAddress, ...extra };
      if (omitKey) delete value[omitKey];
      return value;
    };
    const tooLongNumber = "1".repeat(FIELD_LIMITS.STREET_NUMBER + 1);

    await expect(raw({ store: { address: address({}, "city") } })).rejects.toThrow();
    await expect(raw({ store: { address: address({ extra: "x" }) } })).rejects.toThrow();
    await expect(raw({ store: { address: address({ city: "  " }) } })).rejects.toThrow();
    await expect(
      raw({ store: { address: address({ street: overLimit }) } }),
    ).rejects.toThrow();
    await expect(
      raw({ store: { address: address({ streetNumber: tooLongNumber }) } }),
    ).rejects.toThrow();
    await expect(raw({ store: { address: null } })).rejects.toThrow();
  });

  it("denies timestamps that are not the request time", async () => {
    await expect(raw({ company: { createdAt: new Date() } })).rejects.toThrow();
    await expect(raw({ store: { updatedAt: new Date() } })).rejects.toThrow();
    await expect(raw({ user: { createdAt: new Date() } })).rejects.toThrow();
  });

  it("denies a displayName over the limit", async () => {
    await expect(raw({ user: { displayName: overLimit } })).rejects.toThrow();
  });

  it("allows values at the limit, null streetNumber and null displayName", async () => {
    await raw({
      company: { name: atLimit },
      store: {
        name: atLimit,
        address: { ...validStoreAddress, streetNumber: null },
      },
      user: { displayName: null },
    });
    const profile = (await getDoc(doc(db, "users", account.uid))).data();
    expect(profile.displayName).toBeNull();
  });
});

describe("menu validation rules", () => {
  const { NAME } = FIELD_LIMITS;
  const create = (extra = {}, omitKey) => {
    const data = {
      storeId: storeA.storeId,
      name: "Valid",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra,
    };
    if (omitKey) delete data[omitKey];
    return addDoc(collection(db, "menus"), data);
  };

  it("lets the owner create a menu with a name at the limit", async () => {
    await signInAs(storeA);
    await expect(create({ name: "a".repeat(NAME) })).resolves.toBeDefined();
  });

  it("denies invalid menu creation", async () => {
    await signInAs(storeA);
    await expect(create({}, "name")).rejects.toThrow();
    await expect(create({}, "createdAt")).rejects.toThrow();
    await expect(create({ name: "" })).rejects.toThrow();
    await expect(create({ name: "   " })).rejects.toThrow();
    await expect(create({ name: "a".repeat(NAME + 1) })).rejects.toThrow();
    await expect(create({ extra: "x" })).rejects.toThrow();
    await expect(create({ createdAt: new Date() })).rejects.toThrow();
  });

  describe("update", () => {
    let ref;
    const touch = (data = {}) =>
      updateDoc(ref, { updatedAt: serverTimestamp(), ...data });

    beforeAll(async () => {
      await signInAs(storeA);
      ref = await create();
    });

    it("validates the name and the keys of an update", async () => {
      await signInAs(storeA);
      await expect(touch({ name: "Renamed" })).resolves.toBeUndefined();
      await expect(touch({ name: "a".repeat(NAME) })).resolves.toBeUndefined();
      await expect(touch({ name: "" })).rejects.toThrow();
      await expect(touch({ name: "   " })).rejects.toThrow();
      await expect(touch({ name: "a".repeat(NAME + 1) })).rejects.toThrow();
      await expect(touch({ extra: "x" })).rejects.toThrow();
    });

    it("denies removing a required key", async () => {
      await signInAs(storeA);
      await expect(touch({ name: deleteField() })).rejects.toThrow();
    });

    it("denies changing storeId or createdAt", async () => {
      await signInAs(storeA);
      await expect(touch({ storeId: storeB.storeId })).rejects.toThrow();
      await expect(touch({ createdAt: serverTimestamp() })).rejects.toThrow();
    });

    it("denies an update without updatedAt set to the request time", async () => {
      await signInAs(storeA);
      await expect(updateDoc(ref, { name: "No timestamp" })).rejects.toThrow();
      await expect(touch({ updatedAt: new Date() })).rejects.toThrow();
    });

    it("keeps legacy menus without name or createdAt updatable", async () => {
      await signInAs(storeA);
      const legacyId = await seedDoc("menus", { storeId: storeA.storeId });
      const legacy = doc(db, "menus", legacyId);

      await expect(
        updateDoc(legacy, { name: "Fixed", updatedAt: serverTimestamp() }),
      ).resolves.toBeUndefined();
      await expect(
        updateDoc(legacy, {
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ).rejects.toThrow();
    });
  });
});

describe("category validation rules", () => {
  const { NAME } = FIELD_LIMITS;
  const create = (extra = {}, omitKey) => {
    const data = {
      menuId: storeA.menuId,
      name: `Valid ${Math.random()}`,
      position: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra,
    };
    if (omitKey) delete data[omitKey];
    return addDoc(collection(db, "categories"), data);
  };

  it("lets the owner create a category with a name at the limit", async () => {
    await signInAs(storeA);
    await expect(create({ name: "a".repeat(NAME) })).resolves.toBeDefined();
  });

  it("denies invalid category creation", async () => {
    await signInAs(storeA);
    for (const key of ["menuId", "name", "position", "createdAt", "updatedAt"])
      await expect(create({}, key)).rejects.toThrow();
    await expect(create({ extra: "x" })).rejects.toThrow();
    await expect(create({ name: "" })).rejects.toThrow();
    await expect(create({ name: "   " })).rejects.toThrow();
    await expect(create({ name: "a".repeat(NAME + 1) })).rejects.toThrow();
    await expect(create({ position: 0 })).rejects.toThrow();
    await expect(create({ position: 1.5 })).rejects.toThrow();
    await expect(create({ position: "1" })).rejects.toThrow();
    await expect(create({ createdAt: new Date() })).rejects.toThrow();
  });

  describe("update", () => {
    let ref;
    const touch = (data = {}) =>
      updateDoc(ref, { updatedAt: serverTimestamp(), ...data });

    beforeAll(async () => {
      await signInAs(storeA);
      ref = await create();
    });

    it("validates the name, the position and the keys of an update", async () => {
      await signInAs(storeA);
      await expect(touch({ name: "Renamed" })).resolves.toBeUndefined();
      await expect(touch({ name: "a".repeat(NAME) })).resolves.toBeUndefined();
      await expect(touch({ position: 1 })).resolves.toBeUndefined();
      await expect(touch({ name: "" })).rejects.toThrow();
      await expect(touch({ name: "   " })).rejects.toThrow();
      await expect(touch({ name: "a".repeat(NAME + 1) })).rejects.toThrow();
      await expect(touch({ position: 0 })).rejects.toThrow();
      await expect(touch({ position: 1.5 })).rejects.toThrow();
      await expect(touch({ position: "1" })).rejects.toThrow();
      await expect(touch({ extra: "x" })).rejects.toThrow();
    });

    it("denies removing a required key", async () => {
      await signInAs(storeA);
      await expect(touch({ position: deleteField() })).rejects.toThrow();
    });

    it("denies changing menuId or createdAt", async () => {
      await signInAs(storeA);
      await expect(touch({ menuId: storeB.menuId })).rejects.toThrow();
      await expect(touch({ createdAt: serverTimestamp() })).rejects.toThrow();
    });

    it("denies an update without updatedAt set to the request time", async () => {
      await signInAs(storeA);
      await expect(updateDoc(ref, { name: "No timestamp" })).rejects.toThrow();
      await expect(touch({ updatedAt: new Date() })).rejects.toThrow();
    });

    it("keeps legacy categories without position or createdAt updatable", async () => {
      await signInAs(storeA);
      const legacyId = await seedDoc("categories", {
        menuId: storeA.menuId,
        name: "Legacy",
      });
      const legacy = doc(db, "categories", legacyId);

      await expect(
        updateDoc(legacy, { name: "Fixed", updatedAt: serverTimestamp() }),
      ).resolves.toBeUndefined();
    });
  });
});

describe("product validation rules", () => {
  const { NAME, DESCRIPTION, LIST_SIZE } = FIELD_LIMITS;
  const list = (size) => Array.from({ length: size }, (_, i) => `item ${i}`);
  const create = (extra = {}, omitKey) => {
    const data = {
      categoryId: storeA.categoryId,
      name: `Valid ${Math.random()}`,
      description: null,
      ingredients: null,
      sizes: null,
      price: 10,
      availableCookingLevels: null,
      defaultCookingLevel: null,
      isAvailable: true,
      imageUrl: null,
      position: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra,
    };
    if (omitKey) delete data[omitKey];
    return addDoc(collection(db, "products"), data);
  };

  it("lets the owner create products at the limits", async () => {
    await signInAs(storeA);
    await expect(create({ name: "a".repeat(NAME) })).resolves.toBeDefined();
    await expect(
      create({ description: "a".repeat(DESCRIPTION) }),
    ).resolves.toBeDefined();
    await expect(
      create({ ingredients: list(LIST_SIZE) }),
    ).resolves.toBeDefined();
    await expect(
      create({
        price: null,
        sizes: [{ name: "S", price: 7.5 }],
        availableCookingLevels: list(LIST_SIZE),
        defaultCookingLevel: "item 0",
      }),
    ).resolves.toBeDefined();
    await expect(create({ price: 9.5, position: 2 })).resolves.toBeDefined();
  });

  it("denies a missing or extra key on creation", async () => {
    await signInAs(storeA);
    for (const key of [
      "categoryId",
      "name",
      "description",
      "ingredients",
      "sizes",
      "price",
      "availableCookingLevels",
      "defaultCookingLevel",
      "isAvailable",
      "imageUrl",
      "position",
      "createdAt",
      "updatedAt",
    ])
      await expect(create({}, key)).rejects.toThrow();
    await expect(create({ extra: "x" })).rejects.toThrow();
  });

  it("denies invalid values on creation", async () => {
    await signInAs(storeA);
    await expect(create({ name: "" })).rejects.toThrow();
    await expect(create({ name: "   " })).rejects.toThrow();
    await expect(create({ name: "a".repeat(NAME + 1) })).rejects.toThrow();
    await expect(
      create({ description: "a".repeat(DESCRIPTION + 1) }),
    ).rejects.toThrow();
    await expect(create({ ingredients: list(LIST_SIZE + 1) })).rejects.toThrow();
    await expect(create({ sizes: list(LIST_SIZE + 1) })).rejects.toThrow();
    await expect(
      create({ availableCookingLevels: list(LIST_SIZE + 1) }),
    ).rejects.toThrow();
    await expect(create({ ingredients: "tomato" })).rejects.toThrow();
    await expect(create({ price: -1 })).rejects.toThrow();
    await expect(create({ price: "10" })).rejects.toThrow();
    await expect(create({ isAvailable: "yes" })).rejects.toThrow();
    await expect(create({ imageUrl: 5 })).rejects.toThrow();
    await expect(
      create({ defaultCookingLevel: "a".repeat(101) }),
    ).rejects.toThrow();
    await expect(create({ position: 0 })).rejects.toThrow();
    await expect(create({ position: 1.5 })).rejects.toThrow();
    await expect(create({ position: "1" })).rejects.toThrow();
    await expect(create({ createdAt: new Date() })).rejects.toThrow();
  });

  it("requires either a price or sizes on creation (decision A1)", async () => {
    await signInAs(storeA);
    const sizes = [{ name: "M", price: 12 }];

    await expect(create({ sizes: null, price: null })).rejects.toThrow();
    await expect(create({ sizes: [], price: null })).rejects.toThrow();
    await expect(create({ sizes, price: 12 })).rejects.toThrow();
    await expect(create({ sizes: [], price: 8 })).resolves.toBeDefined();
    await expect(create({ sizes, price: null })).resolves.toBeDefined();
  });

  it("checks pricing on updates that touch sizes or price", async () => {
    await signInAs(storeA);
    const ref = await create();
    const touch = (data) =>
      updateDoc(ref, { updatedAt: serverTimestamp(), ...data });
    const sizes = [{ name: "M", price: 12 }];

    await expect(touch({ price: null })).rejects.toThrow();
    await expect(touch({ sizes })).rejects.toThrow();
    await expect(touch({ sizes, price: null })).resolves.toBeUndefined();
    await expect(touch({ price: 9 })).rejects.toThrow();
    await expect(touch({ sizes: null, price: 9 })).resolves.toBeUndefined();

    // A legacy product without price or sizes stays editable until its
    // pricing is touched, which then must be valid.
    const legacy = doc(
      db,
      "products",
      await seedDoc("products", { categoryId: storeA.categoryId, name: "Old" }),
    );
    await expect(
      updateDoc(legacy, { isAvailable: false, updatedAt: serverTimestamp() }),
    ).resolves.toBeUndefined();
    await expect(
      updateDoc(legacy, { sizes: null, updatedAt: serverTimestamp() }),
    ).rejects.toThrow();
    await expect(
      updateDoc(legacy, { price: 7, updatedAt: serverTimestamp() }),
    ).resolves.toBeUndefined();
  });

  describe("update", () => {
    let ref;
    const touch = (data = {}) =>
      updateDoc(ref, { updatedAt: serverTimestamp(), ...data });

    beforeAll(async () => {
      await signInAs(storeA);
      ref = await create({
        description: "Tasty",
        imageUrl: "https://example.com/a.png",
      });
    });

    it("validates the name, the position and the keys of an update", async () => {
      await signInAs(storeA);
      await expect(touch({ name: "Renamed" })).resolves.toBeUndefined();
      await expect(touch({ name: "a".repeat(NAME) })).resolves.toBeUndefined();
      await expect(touch({ position: 1 })).resolves.toBeUndefined();
      await expect(touch({ name: "" })).rejects.toThrow();
      await expect(touch({ name: "   " })).rejects.toThrow();
      await expect(touch({ name: "a".repeat(NAME + 1) })).rejects.toThrow();
      await expect(touch({ position: 0 })).rejects.toThrow();
      await expect(touch({ position: 1.5 })).rejects.toThrow();
      await expect(touch({ position: "1" })).rejects.toThrow();
      await expect(touch({ extra: "x" })).rejects.toThrow();
    });

    it("lets the optional keys be set to null or valid values", async () => {
      await signInAs(storeA);
      await expect(
        touch({ description: null, imageUrl: null }),
      ).resolves.toBeUndefined();
      await expect(
        touch({ sizes: [{ name: "S", price: 5 }], price: null }),
      ).resolves.toBeUndefined();
      await expect(
        touch({ ingredients: list(LIST_SIZE), price: 12.5, sizes: null }),
      ).resolves.toBeUndefined();
      await expect(
        touch({ description: "a".repeat(DESCRIPTION) }),
      ).resolves.toBeUndefined();
    });

    it("denies wrong types and values", async () => {
      await signInAs(storeA);
      await expect(touch({ price: -1 })).rejects.toThrow();
      await expect(touch({ price: "10" })).rejects.toThrow();
      await expect(touch({ isAvailable: "yes" })).rejects.toThrow();
      await expect(touch({ ingredients: "tomato" })).rejects.toThrow();
      await expect(touch({ ingredients: list(LIST_SIZE + 1) })).rejects.toThrow();
      await expect(touch({ sizes: list(LIST_SIZE + 1) })).rejects.toThrow();
      await expect(
        touch({ availableCookingLevels: list(LIST_SIZE + 1) }),
      ).rejects.toThrow();
      await expect(
        touch({ description: "a".repeat(DESCRIPTION + 1) }),
      ).rejects.toThrow();
    });

    it("denies removing a key", async () => {
      await signInAs(storeA);
      await expect(touch({ description: deleteField() })).rejects.toThrow();
      await expect(touch({ name: deleteField() })).rejects.toThrow();
    });

    it("denies changing categoryId or createdAt", async () => {
      await signInAs(storeA);
      await expect(touch({ categoryId: storeB.categoryId })).rejects.toThrow();
      await expect(touch({ createdAt: serverTimestamp() })).rejects.toThrow();
    });

    it("denies an update without updatedAt set to the request time", async () => {
      await signInAs(storeA);
      await expect(updateDoc(ref, { name: "No timestamp" })).rejects.toThrow();
      await expect(touch({ updatedAt: new Date() })).rejects.toThrow();
    });

    it("keeps legacy products without position or createdAt updatable", async () => {
      await signInAs(storeA);
      const legacyId = await seedDoc("products", {
        categoryId: storeA.categoryId,
        name: "Legacy",
      });
      const legacy = doc(db, "products", legacyId);

      await expect(
        updateDoc(legacy, { name: "Fixed", updatedAt: serverTimestamp() }),
      ).resolves.toBeUndefined();
    });
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
      updateDoc(doc(db, "menus", storeA.menuId), {
        name: "Admin",
        updatedAt: serverTimestamp(),
      }),
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

describe("subscriptions rules", () => {
  // Subscription of company A, seeded with the rules bypassed as the Cloud
  // Functions would write it.
  beforeAll(async () => {
    await seedDoc(
      "subscriptions",
      { status: "active", stripeCustomerId: "cus_test_a" },
      storeA.companyId,
    );
  });

  it("lets the owner read the own Company subscription", async () => {
    await signInAs(storeA);
    const snapshot = await getDoc(doc(db, "subscriptions", storeA.companyId));
    expect(snapshot.data().status).toBe("active");
  });

  it("denies another Company and unauthenticated reads", async () => {
    await signInAs(storeB);
    await expect(
      getDoc(doc(db, "subscriptions", storeA.companyId)),
    ).rejects.toThrow();
    await signout();
    await expect(
      getDoc(doc(db, "subscriptions", storeA.companyId)),
    ).rejects.toThrow();
  });

  it("denies every client write, owner included", async () => {
    await signInAs(storeB);
    await expect(
      setDoc(doc(db, "subscriptions", storeB.companyId), {
        status: "active",
        stripeCustomerId: "cus_fake",
      }),
    ).rejects.toThrow();
    await signInAs(storeA);
    const ref = doc(db, "subscriptions", storeA.companyId);
    await expect(updateDoc(ref, { status: "canceled" })).rejects.toThrow();
    await expect(deleteDoc(ref)).rejects.toThrow();
    await expect(
      setDoc(doc(db, "subscriptions", storeB.companyId), { status: "active" }),
    ).rejects.toThrow();
  });
});

// @vitest-environment node
// End-to-end journey on the Firebase emulators, through the same services the
// UI uses: registration -> onboarding -> store selection -> menu -> orders ->
// status changes -> order history, plus the subscription status. The steps
// share state and run in order. A unique account is created and no emulator
// data is wiped, so other test files are not affected.
import { doc, getDoc } from "firebase/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { app, db } from "../src/services/firebase";
import { login, register, signout } from "../src/services/auth.service";
import { getUserDB } from "../src/services/user.service";
import { createOnboardingWorkspace } from "../src/services/onboarding.service";
import { getAccessibleStore } from "../src/services/store.service";
import { createMenu, isMenuReady } from "../src/services/menu.service";
import { createCategory } from "../src/services/category.service";
import {
  createProduct,
  getProductById,
  updateProductById,
} from "../src/services/product.service";
import { getCustomersByCompanyId } from "../src/services/customer.service";
import {
  ORDER_STATUS,
  ORDER_TYPE,
  buildItemSnapshot,
  cancelOrder,
  createOrder,
  getOrdersByDay,
  updateOrderStatus,
} from "../src/services/order.service";
import {
  isSubscriptionActive,
  subscribeToSubscription,
} from "../src/services/billing.service";

const TEST_EMAIL = `test-e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = "Password123!";

const readRaw = async (collectionName, id) => {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? snap.data() : null;
};

// Writes subscriptions/{companyId} through the emulator REST API with the
// owner token, bypassing the rules like the stripeWebhook function (Admin SDK)
// does. Supports the field types the webhook writes.
const writeSubscriptionAsWebhook = async (companyId, fields) => {
  const toValue = (value) => {
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (typeof value === "boolean") return { booleanValue: value };
    return { stringValue: value };
  };
  const url = `http://localhost:8080/v1/projects/${app.options.projectId}/databases/(default)/documents/subscriptions/${companyId}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, toValue(value)]),
      ),
    }),
  });
  if (!response.ok) throw new Error("Writing the subscription failed");
};

// Resolves with the first subscription value (null when the document is
// missing) that satisfies the predicate, as the Dashboard listener sees it.
const waitForSubscription = (companyId, predicate) =>
  new Promise((resolve, reject) => {
    const unsubscribe = subscribeToSubscription(
      companyId,
      (subscription) => {
        if (!predicate(subscription)) return;
        unsubscribe();
        resolve(subscription);
      },
      reject,
    );
  });

describe("end-to-end flow: registration to order history", () => {
  const state = {};

  afterAll(async () => {
    await signout();
  });

  it("registers a new user without a profile (onboarding required)", async () => {
    const { user } = await register(TEST_EMAIL, TEST_PASSWORD);

    expect(user.email).toBe(TEST_EMAIL);
    expect(await getUserDB(user.uid)).toBeUndefined();

    state.uid = user.uid;
  });

  it("onboards the Company, the Store and the admin User", async () => {
    const { companyId, storeId } = await createOnboardingWorkspace({
      uid: state.uid,
      userName: null,
      companyName: "E2E Pizza Company",
      storeName: "E2E Pizza Store",
      street: "Rue du Rhône",
      streetNumber: "5",
      postalCode: "1204",
      city: "Genève",
      country: "Switzerland",
    });

    const profile = await getUserDB(state.uid);
    expect(profile).toMatchObject({ role: "admin", companyId, storeId });
    expect(await readRaw("companies", companyId)).toMatchObject({
      name: "E2E Pizza Company",
    });

    state.companyId = companyId;
    state.storeId = storeId;
  });

  it("selects the accessible Store, whose Menu is not ready yet", async () => {
    const store = await getAccessibleStore(state.uid);

    expect(store).toMatchObject({
      id: state.storeId,
      companyId: state.companyId,
      name: "E2E Pizza Store",
    });
    expect(await isMenuReady(state.storeId)).toBe(false);
  });

  it("builds the Menu with a Category and Products until it is ready", async () => {
    const menu = await createMenu(state.storeId, "E2E Pizza Store");
    const category = await createCategory(menu.id, "Pizzas", 1);
    const margherita = await createProduct(category.id, {
      name: "Margherita",
      price: 10,
      isAvailable: true,
      position: 1,
    });
    const diavola = await createProduct(category.id, {
      name: "Diavola",
      price: null,
      sizes: [
        { name: "Normal", price: 14 },
        { name: "Large", price: 18.5 },
      ],
      availableCookingLevels: ["Normal", "Well done"],
      defaultCookingLevel: "Normal",
      isAvailable: true,
      position: 2,
    });

    expect(await isMenuReady(state.storeId)).toBe(true);

    state.margheritaId = margherita.id;
    state.diavolaId = diavola.id;
  });

  it("creates a takeaway Order with a new Customer", async () => {
    const margherita = await getProductById(state.margheritaId);
    const items = [
      buildItemSnapshot(margherita, {
        quantity: 2,
        customizations: ["No basil"],
      }),
    ];

    state.takeawayOrderId = await createOrder({
      companyId: state.companyId,
      storeId: state.storeId,
      orderType: ORDER_TYPE.TAKEAWAY,
      scheduledTime: new Date(),
      items,
      customerData: { firstName: "Giulia" },
    });

    const order = await readRaw("orders", state.takeawayOrderId);
    expect(order).toMatchObject({
      storeId: state.storeId,
      orderType: ORDER_TYPE.TAKEAWAY,
      status: ORDER_STATUS.PENDING,
      total: 20,
    });
    expect(order.items).toEqual([
      expect.objectContaining({
        productId: state.margheritaId,
        productName: "Margherita",
        unitPrice: 10,
        quantity: 2,
        customizations: ["No basil"],
        subtotal: 20,
      }),
    ]);
    expect(await readRaw("customers", order.customerId)).toMatchObject({
      companyId: state.companyId,
      firstName: "Giulia",
    });
  });

  it("creates a delivery Order for the existing Customer", async () => {
    const customers = await getCustomersByCompanyId(state.companyId);
    const giulia = customers.find((customer) => customer.firstName === "Giulia");
    const diavola = await getProductById(state.diavolaId);

    state.deliveryOrderId = await createOrder({
      companyId: state.companyId,
      storeId: state.storeId,
      orderType: ORDER_TYPE.DELIVERY,
      scheduledTime: new Date(),
      items: [
        buildItemSnapshot(diavola, {
          size: "Large",
          cookingLevel: "Well done",
          quantity: 1,
        }),
      ],
      customerData: {
        firstName: "Giulia",
        phone: "+41 22 123 45 67",
        address: {
          street: "Rue de Lausanne",
          streetNumber: "20",
          postalCode: "1201",
          city: "Genève",
        },
      },
      existingCustomer: giulia,
    });

    const order = await readRaw("orders", state.deliveryOrderId);
    expect(order).toMatchObject({
      customerId: giulia.id,
      orderType: ORDER_TYPE.DELIVERY,
      status: ORDER_STATUS.PENDING,
      total: 18.5,
    });
    expect(order.items[0]).toMatchObject({
      size: "Large",
      cookingLevel: "Well done",
      unitPrice: 18.5,
    });
    expect(await readRaw("customers", giulia.id)).toMatchObject({
      phone: "+41 22 123 45 67",
      address: expect.objectContaining({ city: "Genève" }),
    });
  });

  it("moves the takeaway Order through the statuses and cancels the delivery Order", async () => {
    await updateOrderStatus(state.takeawayOrderId, ORDER_STATUS.IN_PROGRESS);
    await updateOrderStatus(state.takeawayOrderId, ORDER_STATUS.COMPLETED);
    expect(
      (await readRaw("orders", state.takeawayOrderId)).completedAt,
    ).not.toBeNull();

    await updateOrderStatus(state.takeawayOrderId, ORDER_STATUS.IN_PROGRESS);
    expect(await readRaw("orders", state.takeawayOrderId)).toMatchObject({
      status: ORDER_STATUS.IN_PROGRESS,
      completedAt: null,
    });

    await updateOrderStatus(state.takeawayOrderId, ORDER_STATUS.COMPLETED);
    await cancelOrder(state.deliveryOrderId);

    expect((await readRaw("orders", state.takeawayOrderId)).status).toBe(
      ORDER_STATUS.COMPLETED,
    );
    expect((await readRaw("orders", state.deliveryOrderId)).status).toBe(
      ORDER_STATUS.CANCELLED,
    );
  });

  it("keeps the profile and the Store after logging out and back in", async () => {
    await signout();
    const { user } = await login(TEST_EMAIL, TEST_PASSWORD);

    expect(user.uid).toBe(state.uid);
    expect((await getAccessibleStore(user.uid)).id).toBe(state.storeId);
  });

  it("shows both Orders in today's history with their saved snapshots", async () => {
    await updateProductById(state.margheritaId, { price: 12 });

    const orders = await getOrdersByDay(state.storeId, new Date());

    expect(orders.map((order) => order.id)).toEqual([
      state.deliveryOrderId,
      state.takeawayOrderId,
    ]);
    expect(orders[0].status).toBe(ORDER_STATUS.CANCELLED);
    expect(orders[1]).toMatchObject({
      status: ORDER_STATUS.COMPLETED,
      total: 20,
    });
    expect(orders[1].items[0].unitPrice).toBe(10);
  });

  it("reads the subscription status written by the webhook", async () => {
    expect(
      await waitForSubscription(state.companyId, () => true),
    ).toBeNull();

    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await writeSubscriptionAsWebhook(state.companyId, {
      status: "active",
      stripeCustomerId: "cus_test_e2e",
      stripeSubscriptionId: "sub_test_e2e",
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    });

    const active = await waitForSubscription(
      state.companyId,
      (subscription) => subscription?.status === "active",
    );
    expect(isSubscriptionActive(active)).toBe(true);
    expect(active.currentPeriodEnd.toMillis()).toBe(currentPeriodEnd.getTime());

    await writeSubscriptionAsWebhook(state.companyId, {
      status: "canceled",
      stripeCustomerId: "cus_test_e2e",
      stripeSubscriptionId: "sub_test_e2e",
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    });

    const canceled = await waitForSubscription(
      state.companyId,
      (subscription) => subscription?.status === "canceled",
    );
    expect(isSubscriptionActive(canceled)).toBe(false);
  });
});

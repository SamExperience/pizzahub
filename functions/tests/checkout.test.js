import { describe, expect, it, vi } from "vitest";

import { createCheckoutSessionHandler } from "../checkout.js";
import { createStripeClient } from "../config.js";

// Minimal Firestore fake with set and transactions: { "collection/docId": data }.
function createFakeDb(documents = {}) {
  const writes = [];
  const ref = (name, id) => ({
    path: `${name}/${id}`,
    get: async () => {
      const data = documents[`${name}/${id}`];
      return { exists: data !== undefined, data: () => data };
    },
    set: async (data, options) => {
      writes.push({ path: `${name}/${id}`, data, options });
    },
  });

  return {
    writes,
    db: {
      collection: (name) => ({ doc: (id) => ref(name, id) }),
      runTransaction: async (callback) =>
        callback({
          get: (docRef) => docRef.get(),
          set: (docRef, data, options) => {
            writes.push({ path: docRef.path, data, options });
          },
        }),
    },
  };
}

function stripeSubscription(id, currentPeriodEnd) {
  return {
    id,
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_test" }, current_period_end: currentPeriodEnd }] },
  };
}

function createDeps({ documents, create, getStripe, activeSubscriptions = [], customersCreate } = {}) {
  const sessionsCreate =
    create ?? vi.fn(async () => ({ url: "https://checkout.stripe.test/s" }));
  const createCustomer = customersCreate ?? vi.fn(async () => ({ id: "cus_new" }));
  const subscriptionsList = vi.fn(async () => ({ data: activeSubscriptions }));
  const { db, writes } = createFakeDb(documents);

  return {
    sessionsCreate,
    createCustomer,
    subscriptionsList,
    writes,
    deps: {
      db,
      getStripe:
        getStripe ??
        (() => ({
          checkout: { sessions: { create: sessionsCreate } },
          customers: { create: createCustomer },
          subscriptions: { list: subscriptionsList },
        })),
      priceId: "price_test",
      appUrl: "http://localhost:5173",
    },
  };
}

const adminProfile = { companyId: "company-1", storeId: "store-1", role: "admin" };
const adminRequest = {
  auth: { uid: "uid-1", token: { email: "owner@pizza.test" } },
  data: {},
};

describe("createCheckoutSessionHandler", () => {
  it("rejects unauthenticated callers", async () => {
    const { deps, sessionsCreate } = createDeps();

    await expect(createCheckoutSessionHandler({ data: {} }, deps)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects callers without a profile", async () => {
    const { deps } = createDeps();

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects callers that are not admin", async () => {
    const { deps, sessionsCreate } = createDeps({
      documents: { "users/uid-1": { ...adminProfile, role: "staff" } },
    });

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects a Company whose subscription is already active", async () => {
    const { deps, sessionsCreate } = createDeps({
      documents: {
        "users/uid-1": adminProfile,
        "subscriptions/company-1": { status: "active", stripeCustomerId: "cus_1" },
      },
    });

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects when the Stripe client cannot be created", async () => {
    const { deps } = createDeps({
      documents: { "users/uid-1": adminProfile },
      getStripe: () => createStripeClient("sk_live_123"),
    });

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("creates and stores the Stripe Customer on the first Subscribe", async () => {
    const { deps, sessionsCreate, createCustomer, subscriptionsList, writes } = createDeps({
      documents: { "users/uid-1": adminProfile },
    });

    const result = await createCheckoutSessionHandler(adminRequest, deps);

    expect(result).toEqual({ url: "https://checkout.stripe.test/s" });
    expect(createCustomer).toHaveBeenCalledWith(
      { email: "owner@pizza.test", metadata: { companyId: "company-1" } },
      { idempotencyKey: "customer-company-1" },
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe("subscriptions/company-1");
    expect(writes[0].options).toEqual({ merge: true });
    expect(writes[0].data.stripeCustomerId).toBe("cus_new");
    expect(writes[0].data).not.toHaveProperty("status");
    expect(subscriptionsList).toHaveBeenCalledWith({
      customer: "cus_new",
      status: "active",
      limit: 10,
    });
    expect(sessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_new",
      line_items: [{ price: "price_test", quantity: 1 }],
      client_reference_id: "company-1",
      metadata: { companyId: "company-1" },
      subscription_data: { metadata: { companyId: "company-1" } },
      success_url: "http://localhost:5173/dashboard?checkout=success",
      cancel_url: "http://localhost:5173/dashboard?checkout=cancel",
    });
  });

  it("reuses the stored Stripe Customer of an inactive subscription", async () => {
    const { deps, sessionsCreate, createCustomer, writes } = createDeps({
      documents: {
        "users/uid-1": adminProfile,
        "subscriptions/company-1": { status: "canceled", stripeCustomerId: "cus_1" },
      },
    });

    await createCheckoutSessionHandler(adminRequest, deps);

    expect(createCustomer).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
    const params = sessionsCreate.mock.calls[0][0];
    expect(params.customer).toBe("cus_1");
    expect(params).not.toHaveProperty("customer_email");
  });

  it("syncs an active Stripe subscription and refuses the Checkout", async () => {
    const { deps, sessionsCreate, writes } = createDeps({
      documents: {
        "users/uid-1": adminProfile,
        "subscriptions/company-1": { stripeCustomerId: "cus_1" },
      },
      activeSubscriptions: [stripeSubscription("sub_1", 1_800_000_000)],
    });

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe("subscriptions/company-1");
    expect(writes[0].data).toMatchObject({
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    expect(writes[0].data.currentPeriodEnd.toMillis()).toBe(1_800_000_000_000);
  });

  it("keeps the active subscription with the most distant period end", async () => {
    const { deps, writes } = createDeps({
      documents: {
        "users/uid-1": adminProfile,
        "subscriptions/company-1": { status: "canceled", stripeCustomerId: "cus_1" },
      },
      activeSubscriptions: [
        stripeSubscription("sub_1", 1_800_000_000),
        stripeSubscription("sub_2", 1_900_000_000),
        stripeSubscription("sub_3", 1_850_000_000),
      ],
    });

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(writes[0].data.stripeSubscriptionId).toBe("sub_2");
  });

  it("maps a Stripe Customer creation failure to an internal error", async () => {
    const { deps, sessionsCreate, writes } = createDeps({
      documents: { "users/uid-1": adminProfile },
      customersCreate: vi.fn(async () => {
        throw new Error("Stripe is down");
      }),
    });

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "internal",
    });
    expect(writes).toHaveLength(0);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("never takes the companyId from the request data", async () => {
    const { deps, sessionsCreate } = createDeps({
      documents: { "users/uid-1": adminProfile },
    });

    await createCheckoutSessionHandler(
      { ...adminRequest, data: { companyId: "company-2" } },
      deps,
    );

    const params = sessionsCreate.mock.calls[0][0];
    expect(params.client_reference_id).toBe("company-1");
    expect(params.metadata).toEqual({ companyId: "company-1" });
  });

  it("maps Stripe errors to a generic internal error", async () => {
    const { deps } = createDeps({
      documents: { "users/uid-1": adminProfile },
      create: vi.fn(async () => {
        throw new Error("Stripe is down");
      }),
    });

    await expect(createCheckoutSessionHandler(adminRequest, deps)).rejects.toMatchObject({
      code: "internal",
      message: "Could not start the checkout.",
    });
  });
});

describe("createStripeClient", () => {
  it("refuses keys that are not Stripe test secret keys", () => {
    expect(() => createStripeClient("sk_live_123")).toThrow(/sk_test_/);
    expect(() => createStripeClient(undefined)).toThrow(/sk_test_/);
  });

  it("creates a client for a test secret key", () => {
    expect(createStripeClient("sk_test_123").checkout.sessions).toBeDefined();
  });
});

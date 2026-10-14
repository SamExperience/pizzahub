import { describe, expect, it, vi } from "vitest";

import { createCheckoutSessionHandler } from "../checkout.js";
import { createStripeClient } from "../config.js";

// Minimal Firestore fake: { "collection/docId": data }.
function createFakeDb(documents = {}) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const data = documents[`${name}/${id}`];
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  };
}

function createDeps({ documents, create, getStripe } = {}) {
  const sessionsCreate =
    create ?? vi.fn(async () => ({ url: "https://checkout.stripe.test/s" }));

  return {
    sessionsCreate,
    deps: {
      db: createFakeDb(documents),
      getStripe:
        getStripe ?? (() => ({ checkout: { sessions: { create: sessionsCreate } } })),
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

  it("creates a subscription session for a new customer and returns its url", async () => {
    const { deps, sessionsCreate } = createDeps({
      documents: { "users/uid-1": adminProfile },
    });

    const result = await createCheckoutSessionHandler(adminRequest, deps);

    expect(result).toEqual({ url: "https://checkout.stripe.test/s" });
    expect(sessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_test", quantity: 1 }],
      client_reference_id: "company-1",
      metadata: { companyId: "company-1" },
      subscription_data: { metadata: { companyId: "company-1" } },
      success_url: "http://localhost:5173/dashboard?checkout=success",
      cancel_url: "http://localhost:5173/dashboard?checkout=cancel",
      customer_email: "owner@pizza.test",
    });
  });

  it("reuses the existing Stripe Customer of an inactive subscription", async () => {
    const { deps, sessionsCreate } = createDeps({
      documents: {
        "users/uid-1": adminProfile,
        "subscriptions/company-1": { status: "canceled", stripeCustomerId: "cus_1" },
      },
    });

    await createCheckoutSessionHandler(adminRequest, deps);

    const params = sessionsCreate.mock.calls[0][0];
    expect(params.customer).toBe("cus_1");
    expect(params).not.toHaveProperty("customer_email");
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

import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";

import { createStripeClient } from "../config.js";
import { stripeWebhookHandler } from "../webhook.js";

const WEBHOOK_SECRET = "whsec_test_secret";
const realStripe = createStripeClient("sk_test_123");

// Minimal Firestore fake with transactions: { "collection/docId": data }.
function createFakeDb(documents = {}, { failWrites = false } = {}) {
  const writes = [];
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
    runTransaction: async (callback) =>
      callback({
        get: async (ref) => {
          const data = documents[ref.path];
          return { exists: data !== undefined, data: () => data };
        },
        set: (ref, data, options) => {
          if (failWrites) {
            throw new Error("Firestore unavailable");
          }
          writes.push({ path: ref.path, data, options });
        },
      }),
  };

  return { db, writes };
}

function createStripeFake(retrieve) {
  return {
    webhooks: realStripe.webhooks,
    subscriptions: { retrieve: retrieve ?? vi.fn() },
  };
}

function signedRequest(event, { secret = WEBHOOK_SECRET, signature } = {}) {
  const payload = JSON.stringify(event);
  return {
    method: "POST",
    rawBody: Buffer.from(payload),
    headers: {
      "stripe-signature":
        signature ?? realStripe.webhooks.generateTestHeaderString({ payload, secret }),
    },
  };
}

function createResponse() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.send = (body) => {
    res.body = body;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function subscriptionObject(overrides = {}) {
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    metadata: { companyId: "company-1" },
    items: { data: [{ price: { id: "price_test" }, current_period_end: 1_800_000_000 }] },
    ...overrides,
  };
}

function event(type, object, created = 1_760_000_000) {
  return { id: `evt_${type}`, object: "event", type, created, data: { object } };
}

async function run(req, { documents, retrieve, getStripe, failWrites } = {}) {
  const { db, writes } = createFakeDb(documents, { failWrites });
  const stripe = createStripeFake(retrieve);
  const res = createResponse();

  await stripeWebhookHandler(req, res, {
    db,
    getStripe: getStripe ?? (() => stripe),
    webhookSecret: WEBHOOK_SECRET,
  });

  return { res, writes, stripe };
}

describe("stripeWebhookHandler", () => {
  it("rejects methods other than POST", async () => {
    const { res, writes } = await run({ method: "GET", headers: {} });

    expect(res.statusCode).toBe(405);
    expect(writes).toHaveLength(0);
  });

  it("returns 400 without a Stripe-Signature header", async () => {
    const req = signedRequest(event("customer.subscription.updated", subscriptionObject()));
    delete req.headers["stripe-signature"];

    const { res, writes } = await run(req);

    expect(res.statusCode).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("returns 400 when the signature does not match", async () => {
    const req = signedRequest(event("customer.subscription.updated", subscriptionObject()), {
      secret: "whsec_other",
    });

    const { res, writes } = await run(req);

    expect(res.statusCode).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("returns 400 when the body was changed after signing", async () => {
    const req = signedRequest(event("customer.subscription.updated", subscriptionObject()));
    req.rawBody = Buffer.from(
      JSON.stringify(event("customer.subscription.updated", subscriptionObject({ status: "canceled" }))),
    );

    const { res, writes } = await run(req);

    expect(res.statusCode).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("returns 500 when the Stripe key is not a test key", async () => {
    const req = signedRequest(event("customer.subscription.updated", subscriptionObject()));

    const { res, writes } = await run(req, { getStripe: () => createStripeClient("sk_live_123") });

    expect(res.statusCode).toBe(500);
    expect(writes).toHaveLength(0);
  });

  it("acknowledges unknown event types without writing", async () => {
    const { res, writes } = await run(signedRequest(event("invoice.paid", { id: "in_1" })));

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: true });
    expect(writes).toHaveLength(0);
  });

  it("stores the retrieved subscription on checkout.session.completed", async () => {
    const retrieve = vi.fn(async () => subscriptionObject());
    const session = {
      id: "cs_1",
      object: "checkout.session",
      mode: "subscription",
      client_reference_id: "company-1",
      metadata: { companyId: "company-1" },
      subscription: "sub_1",
    };

    const { res, writes } = await run(signedRequest(event("checkout.session.completed", session)), {
      retrieve,
    });

    expect(res.statusCode).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("sub_1");
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe("subscriptions/company-1");
    expect(writes[0].options).toEqual({ merge: true });
    expect(writes[0].data).toMatchObject({
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      priceId: "price_test",
      cancelAtPeriodEnd: false,
    });
    expect(writes[0].data.currentPeriodEnd.toMillis()).toBe(1_800_000_000_000);
    expect(writes[0].data.lastEventAt.toMillis()).toBe(1_760_000_000_000);
    expect(writes[0].data.updatedAt).toBeDefined();
  });

  it("ignores checkout sessions that are not subscriptions", async () => {
    const retrieve = vi.fn();
    const session = { id: "cs_1", mode: "payment", client_reference_id: "company-1" };

    const { res, writes } = await run(signedRequest(event("checkout.session.completed", session)), {
      retrieve,
    });

    expect(res.statusCode).toBe(200);
    expect(retrieve).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("maps a scheduled cancellation on customer.subscription.updated", async () => {
    const subscription = subscriptionObject({ cancel_at_period_end: true });

    const { res, writes } = await run(
      signedRequest(event("customer.subscription.updated", subscription)),
    );

    expect(res.statusCode).toBe(200);
    expect(writes[0].data).toMatchObject({ status: "active", cancelAtPeriodEnd: true });
  });

  it("stores the canceled status on customer.subscription.deleted", async () => {
    const subscription = subscriptionObject({ status: "canceled" });

    const { writes } = await run(signedRequest(event("customer.subscription.deleted", subscription)));

    expect(writes[0].path).toBe("subscriptions/company-1");
    expect(writes[0].data.status).toBe("canceled");
  });

  it("ignores events older than the last applied one", async () => {
    const documents = {
      "subscriptions/company-1": {
        status: "canceled",
        lastEventAt: Timestamp.fromMillis(1_760_000_100_000),
      },
    };

    const { res, writes } = await run(
      signedRequest(event("customer.subscription.updated", subscriptionObject())),
      { documents },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: true });
    expect(writes).toHaveLength(0);
  });

  it("applies events newer than the last applied one", async () => {
    const documents = {
      "subscriptions/company-1": {
        status: "incomplete",
        lastEventAt: Timestamp.fromMillis(1_759_999_000_000),
      },
    };

    const { res, writes } = await run(
      signedRequest(event("customer.subscription.updated", subscriptionObject())),
      { documents },
    );

    expect(res.statusCode).toBe(200);
    expect(writes[0].data.status).toBe("active");
  });

  it("ignores events of another subscription while the stored one is active", async () => {
    const documents = {
      "subscriptions/company-1": { status: "active", stripeSubscriptionId: "sub_1" },
    };

    const { res, writes } = await run(
      signedRequest(
        event("customer.subscription.deleted", subscriptionObject({ id: "sub_2", status: "canceled" })),
      ),
      { documents },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: true });
    expect(writes).toHaveLength(0);
  });

  it("applies events of another subscription when the stored one is not active", async () => {
    const documents = {
      "subscriptions/company-1": { status: "canceled", stripeSubscriptionId: "sub_1" },
    };

    const { writes } = await run(
      signedRequest(event("customer.subscription.updated", subscriptionObject({ id: "sub_2" }))),
      { documents },
    );

    expect(writes[0].data).toMatchObject({ status: "active", stripeSubscriptionId: "sub_2" });
  });

  it("applies events of the stored active subscription", async () => {
    const documents = {
      "subscriptions/company-1": { status: "active", stripeSubscriptionId: "sub_1" },
    };

    const { writes } = await run(
      signedRequest(
        event("customer.subscription.updated", subscriptionObject({ cancel_at_period_end: true })),
      ),
      { documents },
    );

    expect(writes[0].data.cancelAtPeriodEnd).toBe(true);
  });

  it("ignores subscription events without a companyId", async () => {
    const subscription = subscriptionObject({ metadata: {} });

    const { res, writes } = await run(
      signedRequest(event("customer.subscription.updated", subscription)),
    );

    expect(res.statusCode).toBe(200);
    expect(writes).toHaveLength(0);
  });

  it("returns 500 when the write fails so Stripe retries", async () => {
    const { res } = await run(
      signedRequest(event("customer.subscription.updated", subscriptionObject())),
      { failWrites: true },
    );

    expect(res.statusCode).toBe(500);
  });
});

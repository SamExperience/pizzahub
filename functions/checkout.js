import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  appUrl,
  createStripeClient,
  stripePriceId,
  stripeSecretKey,
} from "./config.js";
import { applySubscription, buildSubscriptionData } from "./subscription.js";

// Reads the caller's profile and returns its companyId; only an admin may subscribe.
async function getAdminCompanyId(db, uid) {
  const userSnapshot = await db.collection("users").doc(uid).get();
  const user = userSnapshot.exists ? userSnapshot.data() : null;

  if (!user || user.role !== "admin" || !user.companyId) {
    throw new HttpsError(
      "permission-denied",
      "Only the Company admin can manage the subscription.",
    );
  }

  return user.companyId;
}

function buildSessionParams({ companyId, customerId, priceId, appUrl }) {
  return {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: companyId,
    metadata: { companyId },
    subscription_data: { metadata: { companyId } },
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/dashboard?checkout=cancel`,
  };
}

// One Stripe Customer per Company: created on the first Subscribe and stored before any Checkout,
// so every later Checkout and the active-subscription check use the same Customer.
async function ensureStripeCustomer({ db, stripe, companyId, subscription, email }) {
  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  // The idempotency key makes a double click return the same Customer.
  const customer = await stripe.customers.create(
    { email, metadata: { companyId } },
    { idempotencyKey: `customer-${companyId}` },
  );

  await db.collection("subscriptions").doc(companyId).set(
    { stripeCustomerId: customer.id, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return customer.id;
}

function periodEnd(subscription) {
  return subscription.items?.data?.[0]?.current_period_end ?? 0;
}

// Returns the Customer's active Stripe subscription with the most distant period end, or null.
// Covers a webhook that is late or was missed: Stripe is checked, not only Firestore.
async function findActiveSubscription(stripe, customerId) {
  const { data } = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 10,
  });

  return data.reduce(
    (latest, current) =>
      !latest || periodEnd(current) > periodEnd(latest) ? current : latest,
    null,
  );
}

// The companyId is always taken from the caller's profile, never from request.data.
export async function createCheckoutSessionHandler(request, deps) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to subscribe.");
  }

  const { db, getStripe, priceId, appUrl } = deps;
  const companyId = await getAdminCompanyId(db, request.auth.uid);

  const subscriptionSnapshot = await db
    .collection("subscriptions")
    .doc(companyId)
    .get();
  const subscription = subscriptionSnapshot.exists
    ? subscriptionSnapshot.data()
    : null;

  if (subscription?.status === "active") {
    throw new HttpsError(
      "failed-precondition",
      "The subscription is already active.",
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    logger.error("Stripe client not available", error);
    throw new HttpsError(
      "failed-precondition",
      "Payments are not configured.",
    );
  }

  let activeSubscription;
  let session;
  try {
    const customerId = await ensureStripeCustomer({
      db,
      stripe,
      companyId,
      subscription,
      email: request.auth.token?.email,
    });

    activeSubscription = await findActiveSubscription(stripe, customerId);

    if (!activeSubscription) {
      session = await stripe.checkout.sessions.create(
        buildSessionParams({ companyId, customerId, priceId, appUrl }),
      );
    }
  } catch (error) {
    logger.error("Checkout start failed", error);
    throw new HttpsError("internal", "Could not start the checkout.");
  }

  if (activeSubscription) {
    // Same mapping and stale-event guard as the webhook; the state was read just now.
    await applySubscription(
      db,
      companyId,
      buildSubscriptionData(activeSubscription, Math.floor(Date.now() / 1000)),
    );
    throw new HttpsError(
      "failed-precondition",
      "The subscription is already active.",
    );
  }

  return { url: session.url };
}

export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  (request) =>
    createCheckoutSessionHandler(request, {
      db: getFirestore(),
      getStripe: () => createStripeClient(stripeSecretKey.value()),
      priceId: stripePriceId.value(),
      appUrl: appUrl.value(),
    }),
);

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
/**
 * Loads users/{uid} and returns its companyId when the user is the Company
 * admin.
 * @private
 * @param {Firestore} db
 * @param {string} uid - Caller's Auth uid.
 * @returns {Promise<string>} The admin's companyId.
 * @throws {HttpsError} permission-denied when the user is missing, not an admin or has no companyId.
 * @example
 * const companyId = await getAdminCompanyId(db, request.auth.uid);
 */
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

/**
 * Builds the Stripe Checkout Session parameters for a one-seat subscription.
 * The companyId is set as client_reference_id and as metadata on both the
 * session and the subscription, so the webhook can map events to a Company.
 * @private
 * @param {object} params
 * @param {string} params.companyId
 * @param {string} params.customerId - Stripe Customer id.
 * @param {string} params.priceId - Stripe Price id.
 * @param {string} params.appUrl - Base URL for the success and cancel redirects.
 * @returns {object} Parameters for stripe.checkout.sessions.create.
 * @example
 * const params = buildSessionParams({ companyId, customerId, priceId, appUrl });
 */
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
/**
 * Returns the Company's Stripe Customer id, creating the Customer (with an
 * idempotency key) and merging its id into subscriptions/{companyId} if none
 * is stored yet.
 * @private
 * @param {object} params
 * @param {Firestore} params.db
 * @param {object} params.stripe - Stripe client.
 * @param {string} params.companyId
 * @param {?object} params.subscription - Stored subscriptions/{companyId} data, or null.
 * @param {string} [params.email] - Caller's email, set on a new Customer.
 * @returns {Promise<string>} The Stripe Customer id.
 * @example
 * const customerId = await ensureStripeCustomer({ db, stripe, companyId, subscription, email });
 */
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

/**
 * Returns the current period end of a Stripe Subscription's first item.
 * @private
 * @param {object} subscription - Stripe Subscription object.
 * @returns {number} Unix seconds, or 0 when the item has no period end.
 * @example
 * const end = periodEnd(subscription);
 */
function periodEnd(subscription) {
  return subscription.items?.data?.[0]?.current_period_end ?? 0;
}

// Returns the Customer's active Stripe subscription with the most distant period end, or null.
// Covers a webhook that is late or was missed: Stripe is checked, not only Firestore.
/**
 * Lists up to 10 active Stripe subscriptions of the Customer and returns the
 * one with the latest period end.
 * @private
 * @param {object} stripe - Stripe client.
 * @param {string} customerId - Stripe Customer id.
 * @returns {Promise<?object>} The Stripe Subscription object, or null.
 * @example
 * const active = await findActiveSubscription(stripe, customerId);
 */
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

/**
 * Logic of the createCheckoutSession callable, separated from onCall so the
 * tests can inject Firestore and a fake Stripe client. The companyId is
 * always taken from the caller's profile, never from request.data. Refuses
 * when a subscription is already active (in Firestore or in Stripe, which
 * also syncs Firestore), so a Company is never charged twice.
 * @param {CallableRequest} request
 * @param {object} deps
 * @param {Firestore} deps.db
 * @param {function(): object} deps.getStripe - Returns the Stripe client.
 * @param {string} deps.priceId
 * @param {string} deps.appUrl
 * @returns {Promise<{url: string}>} The Stripe Checkout URL.
 * @throws {HttpsError} unauthenticated, permission-denied, failed-precondition or internal.
 * @example
 * const { url } = await createCheckoutSessionHandler(request, { db, getStripe, priceId, appUrl });
 */
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

/**
 * Callable function that starts a Stripe Checkout for the caller's Company.
 * Only the secret key is bound, and params are read at call time.
 * @type {CallableFunction}
 * @example
 * // Client side:
 * await httpsCallable(functions, "createCheckoutSession")();
 */
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

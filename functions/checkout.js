import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  appUrl,
  createStripeClient,
  stripePriceId,
  stripeSecretKey,
} from "./config.js";

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

function buildSessionParams({ companyId, subscription, email, priceId, appUrl }) {
  const params = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: companyId,
    metadata: { companyId },
    subscription_data: { metadata: { companyId } },
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/dashboard?checkout=cancel`,
  };

  // Reuse the Company's Stripe Customer if it already has one; otherwise
  // Checkout creates it and the webhook stores it.
  if (subscription?.stripeCustomerId) {
    params.customer = subscription.stripeCustomerId;
  } else if (email) {
    params.customer_email = email;
  }

  return params;
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

  try {
    const session = await stripe.checkout.sessions.create(
      buildSessionParams({
        companyId,
        subscription,
        email: request.auth.token?.email,
        priceId,
        appUrl,
      }),
    );

    return { url: session.url };
  } catch (error) {
    logger.error("Checkout Session creation failed", error);
    throw new HttpsError("internal", "Could not start the checkout.");
  }
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

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import {
  createStripeClient,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./config.js";

const SUBSCRIPTION_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

function toTimestamp(seconds) {
  return typeof seconds === "number" ? Timestamp.fromMillis(seconds * 1000) : null;
}

// Maps a Stripe Subscription to the subscriptions/{companyId} fields (docs/01-data-model.md).
// The billing period lives on the subscription item in current Stripe API versions.
export function buildSubscriptionData(subscription, eventCreated) {
  const item = subscription.items?.data?.[0];
  const customer = subscription.customer;

  return {
    status: subscription.status,
    stripeCustomerId: typeof customer === "string" ? customer : customer?.id,
    stripeSubscriptionId: subscription.id,
    priceId: item?.price?.id ?? null,
    currentPeriodEnd: toTimestamp(item?.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    lastEventAt: toTimestamp(eventCreated),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// Returns { companyId, subscription } for the handled event types, or null to ignore the event.
async function resolveSubscription(event, stripe) {
  const object = event.data.object;

  if (event.type === "checkout.session.completed") {
    if (object.mode !== "subscription" || !object.subscription) {
      return null;
    }

    const subscriptionId =
      typeof object.subscription === "string"
        ? object.subscription
        : object.subscription.id;

    // The session carries only ids: read the current state from Stripe.
    return {
      companyId: object.client_reference_id ?? object.metadata?.companyId,
      subscription: await stripe.subscriptions.retrieve(subscriptionId),
    };
  }

  if (SUBSCRIPTION_EVENTS.includes(event.type)) {
    return { companyId: object.metadata?.companyId, subscription: object };
  }

  return null;
}

// Writes the subscription unless a newer event was already applied (Stripe does not guarantee order).
async function applySubscription(db, companyId, data) {
  const ref = db.collection("subscriptions").doc(companyId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const lastEventAt = snapshot.exists ? snapshot.data().lastEventAt : null;

    if (lastEventAt && data.lastEventAt.toMillis() < lastEventAt.toMillis()) {
      return false;
    }

    transaction.set(ref, data, { merge: true });
    return true;
  });
}

export async function stripeWebhookHandler(req, res, deps) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { db, getStripe, webhookSecret } = deps;

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    logger.error("Stripe client not available", error);
    res.status(500).send("Payments are not configured");
    return;
  }

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    if (!signature) {
      throw new Error("Missing Stripe-Signature header");
    }
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (error) {
    logger.warn("Stripe webhook signature verification failed", error.message);
    res.status(400).send("Invalid signature");
    return;
  }

  try {
    const resolved = await resolveSubscription(event, stripe);

    if (!resolved) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    if (!resolved.companyId) {
      logger.warn("Stripe event without companyId ignored", { eventId: event.id });
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const applied = await applySubscription(
      db,
      resolved.companyId,
      buildSubscriptionData(resolved.subscription, event.created),
    );

    if (!applied) {
      logger.info("Stale Stripe event ignored", { eventId: event.id });
    }

    res.status(200).json({ received: true, ignored: !applied });
  } catch (error) {
    // A 5xx makes Stripe retry the event later.
    logger.error("Stripe webhook processing failed", { eventId: event.id, error });
    res.status(500).send("Webhook processing failed");
  }
}

export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  (req, res) =>
    stripeWebhookHandler(req, res, {
      db: getFirestore(),
      getStripe: () => createStripeClient(stripeSecretKey.value()),
      webhookSecret: stripeWebhookSecret.value(),
    }),
);

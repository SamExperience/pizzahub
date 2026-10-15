import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

import {
  createStripeClient,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./config.js";
import { applySubscription, buildSubscriptionData } from "./subscription.js";

const SUBSCRIPTION_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

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

/**
 * Logic of the Stripe webhook, separated from onRequest for testing. The
 * signature is verified on the raw body (400 when invalid), so nobody can
 * fake a payment; unknown event types get 200 so Stripe stops retrying
 * them, while processing errors get 500 so Stripe retries later.
 * @param {object} req - Request with rawBody and the stripe-signature header.
 * @param {object} res - Express-style response.
 * @param {object} deps
 * @param {Firestore} deps.db
 * @param {function(): object} deps.getStripe
 * @param {string} deps.webhookSecret
 * @returns {Promise<void>}
 * @example
 * await stripeWebhookHandler(req, res, { db, getStripe, webhookSecret: "whsec_..." });
 */
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

/**
 * HTTPS endpoint registered in Stripe as the webhook. It is the main writer
 * of subscriptions/{companyId} (the client can only read it).
 * @type {HttpsFunction}
 * @example
 * // stripe listen --forward-to http://127.0.0.1:5001/<project>/europe-west6/stripeWebhook
 */
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  (req, res) =>
    stripeWebhookHandler(req, res, {
      db: getFirestore(),
      getStripe: () => createStripeClient(stripeSecretKey.value()),
      webhookSecret: stripeWebhookSecret.value(),
    }),
);

import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret, defineString } from "firebase-functions/params";
import Stripe from "stripe";

// Same region as the project's Firestore database and Storage bucket (europe-west6, Zurich).
// Set here, not in index.js: every function module imports this file before
// defining its triggers, and triggers read the global options when defined.
// Two instances are enough for MVP traffic and bound the cost of abusive bursts.
setGlobalOptions({ region: "europe-west6", maxInstances: 2 });

/**
 * Stripe secret key. Secrets live in Google Secret Manager (local emulator:
 * functions/.secret.local), never in the client or the repository.
 * @type {SecretParam}
 * @example
 * createStripeClient(stripeSecretKey.value());
 */
export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
/**
 * Signing secret of the Stripe webhook endpoint, used to verify that events
 * really come from Stripe.
 * @type {SecretParam}
 * @example
 * stripe.webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret.value());
 */
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

/**
 * Id of the single monthly Price (not secret; functions/.env.<projectId> or
 * prompted on deploy). Fixed on the server so a client cannot choose a price.
 * @type {StringParam}
 * @example
 * stripePriceId.value(); // "price_..."
 */
export const stripePriceId = defineString("STRIPE_PRICE_ID");
/**
 * Public URL of the app, used to build the Checkout success and cancel URLs
 * on the server instead of trusting a URL sent by the client.
 * @type {StringParam}
 * @example
 * `${appUrl.value()}/dashboard?checkout=success`;
 */
export const appUrl = defineString("APP_URL");

/**
 * Creates the Stripe client. Test mode only: any key that is not a Stripe
 * test secret key is refused, so a live key can never take real payments.
 * @param {string} secretKey
 * @returns {Stripe}
 * @throws {Error} When the key does not start with sk_test_.
 * @example
 * const stripe = createStripeClient("sk_test_123");
 */
export function createStripeClient(secretKey) {
  if (typeof secretKey !== "string" || !secretKey.startsWith("sk_test_")) {
    throw new Error("Only Stripe test secret keys (sk_test_) are allowed.");
  }

  return new Stripe(secretKey);
}

import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret, defineString } from "firebase-functions/params";
import Stripe from "stripe";

// Same region as the project's Firestore database and Storage bucket (europe-west6, Zurich).
// Set here, not in index.js: every function module imports this file before
// defining its triggers, and triggers read the global options when defined.
setGlobalOptions({ region: "europe-west6", maxInstances: 10 });

// Secrets live in Google Secret Manager (local emulator: functions/.secret.local).
export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Non-secret params (functions/.env.<projectId> or prompted on deploy).
export const stripePriceId = defineString("STRIPE_PRICE_ID");
export const appUrl = defineString("APP_URL");

// Test mode only: any key that is not a Stripe test secret key is refused.
export function createStripeClient(secretKey) {
  if (typeof secretKey !== "string" || !secretKey.startsWith("sk_test_")) {
    throw new Error("Only Stripe test secret keys (sk_test_) are allowed.");
  }

  return new Stripe(secretKey);
}

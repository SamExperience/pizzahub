import { initializeApp } from "firebase-admin/app";

initializeApp();

export { createCheckoutSession } from "./checkout.js";
export { stripeWebhook } from "./webhook.js";

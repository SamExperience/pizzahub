import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "./firebase";

/**
 * Only this Stripe status counts as an active subscription
 * (spec/01-data-model.md); past_due, canceled and the others do not.
 * @type {string}
 * @example
 * subscription.status === SUBSCRIPTION_STATUS_ACTIVE;
 */
export const SUBSCRIPTION_STATUS_ACTIVE = "active";

/**
 * Tells whether the Company's subscription is active. A missing document or
 * any status other than "active" is inactive, so a Company that never
 * subscribed sees the warning banner.
 * @param {?{status: (string|undefined)}} subscription - subscriptions/{companyId} data.
 * @returns {boolean}
 * @example
 * isSubscriptionActive({ status: "active" }); // true
 * isSubscriptionActive(null); // false
 */
export const isSubscriptionActive = (subscription) =>
  subscription?.status === SUBSCRIPTION_STATUS_ACTIVE;

/**
 * Creates a Stripe Checkout Session through the createCheckoutSession
 * function and redirects the browser to it. No data is sent: the function
 * takes the companyId from the caller's profile, so a client cannot pay for
 * (or inspect) another Company.
 * @returns {Promise<void>}
 * @example
 * await startCheckout(); // the browser leaves for checkout.stripe.com
 */
export const startCheckout = async () => {
  const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
  const result = await createCheckoutSession();
  const url = result?.data?.url;

  if (!url) throw new Error("Could not start the checkout.");

  window.location.assign(url);
};

/**
 * Listens to the Company's subscription in real time, so the banner and the
 * Dashboard update as soon as the webhook writes after Checkout. Calls
 * onChange with the subscription, or null when the Company never subscribed.
 * @param {string} companyId
 * @param {function(?object): void} onChange
 * @param {function(Error): void} [onError]
 * @returns {function(): void} Unsubscribe function.
 * @example
 * const stop = subscribeToSubscription("company1", setSubscription);
 * stop();
 */
export const subscribeToSubscription = (companyId, onChange, onError) => {
  if (!companyId) throw new Error("Company ID is required");

  if (typeof onChange !== "function")
    throw new Error("onChange callback is required");

  return onSnapshot(
    doc(db, "subscriptions", companyId),
    (snapshot) =>
      onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
};

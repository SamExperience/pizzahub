import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "./firebase";

// Only this Stripe status counts as an active subscription (docs/01-data-model.md).
export const SUBSCRIPTION_STATUS_ACTIVE = "active";

// A missing document or any status other than "active" is inactive.
export const isSubscriptionActive = (subscription) =>
  subscription?.status === SUBSCRIPTION_STATUS_ACTIVE;

// Creates a Stripe Checkout Session through the createCheckoutSession
// function and redirects the browser to it. No data is sent: the function
// takes the companyId from the caller's profile.
export const startCheckout = async () => {
  const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
  const result = await createCheckoutSession();
  const url = result?.data?.url;

  if (!url) throw new Error("Could not start the checkout.");

  window.location.assign(url);
};

// Listens to the Company's subscription in real time. Calls onChange with the
// subscription, or null when the Company never subscribed, at every change and
// returns the unsubscribe function.
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

import { FieldValue, Timestamp } from "firebase-admin/firestore";

function toTimestamp(seconds) {
  return typeof seconds === "number" ? Timestamp.fromMillis(seconds * 1000) : null;
}

// Maps a Stripe Subscription to the subscriptions/{companyId} fields (spec/01-data-model.md).
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

// Writes the subscription unless a newer event was already applied (Stripe does not guarantee order)
// or the stored active subscription is a different one (a duplicate must not overwrite it).
export async function applySubscription(db, companyId, data) {
  const ref = db.collection("subscriptions").doc(companyId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const stored = snapshot.exists ? snapshot.data() : null;

    if (
      stored?.lastEventAt &&
      data.lastEventAt.toMillis() < stored.lastEventAt.toMillis()
    ) {
      return false;
    }

    if (
      stored?.status === "active" &&
      stored.stripeSubscriptionId &&
      stored.stripeSubscriptionId !== data.stripeSubscriptionId
    ) {
      return false;
    }

    transaction.set(ref, data, { merge: true });
    return true;
  });
}

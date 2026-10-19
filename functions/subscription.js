import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Converts Unix seconds to a Firestore Timestamp.
 * @private
 * @param {*} seconds - Unix seconds; any non-number yields null.
 * @returns {?Timestamp} The Timestamp, or null.
 * @example
 * const lastEventAt = toTimestamp(event.created);
 */
function toTimestamp(seconds) {
  return typeof seconds === "number" ? Timestamp.fromMillis(seconds * 1000) : null;
}

/**
 * Maps a Stripe Subscription to the subscriptions/{companyId} fields
 * (spec/01-data-model.md). Shared by the webhook and the Checkout sync, so
 * both write the same shape. The billing period lives on the subscription
 * item in current Stripe API versions.
 * @param {object} subscription - Stripe Subscription object.
 * @param {number} eventCreated - Unix seconds of the event (stale-event guard).
 * @returns {object} Firestore fields.
 * @example
 * const data = buildSubscriptionData(event.data.object, event.created);
 */
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

/**
 * Writes the subscription in a transaction unless a newer event was already
 * applied (Stripe does not guarantee order) or the stored active
 * subscription is a different one (a duplicate must not overwrite it).
 * @param {Firestore} db
 * @param {string} companyId
 * @param {object} data - Output of buildSubscriptionData.
 * @returns {Promise<boolean>} True when written, false when ignored.
 * @example
 * const applied = await applySubscription(db, "company1", data);
 */
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

import { useId, useState } from "react";
import { useSearchParams } from "react-router";
import { Info } from "lucide-react";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";
import { useAuth } from "../contexts/AuthContext";
import { isSubscriptionActive, startCheckout } from "../services/billing.service";
import { formatDate } from "../utils/format";
import useSubscription from "../utils/useSubscription";
import { alert, badge, card, muted, primaryButton, sectionTitle } from "../utils/styles";
import { logError } from "../utils/logger";

// Labels of the Stripe statuses (spec/01-data-model.md); unknown ones are shown as received.
const STATUS_LABELS = {
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete (expired)",
  unpaid: "Unpaid",
  paused: "Paused",
};

const info =
  "flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800";

/**
 * Dashboard section with the Company's subscription status and the Stripe
 * Checkout entry point (test mode). After the return from Checkout it shows
 * "payment processing" until the webhook writes the active status.
 * @returns {JSX.Element}
 * @example
 * <SubscriptionSection />
 */
export default function SubscriptionSection() {
  const { userProfile } = useAuth();
  const { subscription, loading, error, retry } = useSubscription(
    userProfile?.companyId,
  );
  const [searchParams] = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const titleId = useId();

  const active = isSubscriptionActive(subscription);
  const checkout = searchParams.get("checkout");
  // The ?checkout=success URL stays after the return from Checkout: the message
  // is shown only while the webhook has not written a final status yet. A document
  // without status holds only the Stripe Customer created on the first Subscribe.
  const status = subscription?.status;
  const processing = checkout === "success" && (!status || status === "incomplete");
  // The period date is meaningful only for an active subscription.
  const endDate = active ? formatDate(subscription.currentPeriodEnd) : null;

  const handleSubscribe = async () => {
    setCheckoutError(null);
    setRedirecting(true);

    try {
      // On success the browser leaves the page, so redirecting stays true.
      await startCheckout();
    } catch (err) {
      logError("Error starting the checkout -> ", err);
      setCheckoutError(err);
      setRedirecting(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4">
      <h2 id={titleId} className={`${sectionTitle} m-0`}>
        Subscription
      </h2>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message="Unable to load the subscription." onRetry={retry} />
      ) : (
        <div className={`${card} flex flex-col gap-4`}>
          {processing && (
            <p role="status" className={`${info} m-0`}>
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Payment is being processed. The status updates automatically in a few moments.
            </p>
          )}
          {checkout === "cancel" && !active && (
            <p role="status" className={`${info} m-0`}>
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Checkout cancelled. No payment was made.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-700">Status</span>
            <span
              className={`${badge} ${
                active ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {status ? (STATUS_LABELS[status] ?? status) : "No subscription"}
            </span>
          </div>

          {endDate && (
            <p className="m-0 text-sm text-neutral-700">
              {subscription.cancelAtPeriodEnd ? "Ends on " : "Renews on "}
              {endDate}
            </p>
          )}

          {!active && (
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                className={primaryButton}
                disabled={redirecting}
                onClick={handleSubscribe}
              >
                {redirecting ? "Redirecting to checkout ..." : "Subscribe"}
              </button>
              {checkoutError && (
                <p role="alert" className={`${alert} m-0`}>
                  Unable to start the checkout. Please try again.
                </p>
              )}
            </div>
          )}

          <p className={`${muted} m-0`}>Test mode: no real payments are made.</p>
        </div>
      )}
    </section>
  );
}
